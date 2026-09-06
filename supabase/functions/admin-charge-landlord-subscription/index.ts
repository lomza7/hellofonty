import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import Stripe from 'npm:stripe@14.10.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const PREMIUM_AMOUNT = 5900; // 59.00 EUR in cents

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Non authentifié');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify caller is admin
    const { data: adminProfile, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (adminError || !adminProfile || adminProfile.role !== 'admin') {
      throw new Error('Accès refusé : administrateur uniquement');
    }

    const body = await req.json();
    const { landlord_id, lease_id, charge_id, action } = body;

    // --- Action: toggle exemption ---
    if (action === 'toggle_exempt') {
      if (!landlord_id) throw new Error('ID du propriétaire manquant');

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('subscription_exempt, subscription_exempt_reason, subscription_exempt_until')
        .eq('id', landlord_id)
        .maybeSingle();

      if (!profile) throw new Error('Propriétaire introuvable');

      const newExempt = !profile.subscription_exempt;
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({
          subscription_exempt: newExempt,
          subscription_exempt_reason: body.reason || null,
          subscription_exempt_until: body.until || null,
        })
        .eq('id', landlord_id);

      if (updateErr) throw new Error('Erreur lors de la mise à jour de l\'exonération');

      // If enabling exemption, mark all pending/failed charges as exempted
      if (newExempt) {
        await supabaseAdmin
          .from('landlord_subscription_charges')
          .update({ status: 'exempted' })
          .eq('landlord_id', landlord_id)
          .in('status', ['pending', 'failed']);
      } else {
        // If removing exemption, re-activate failed charges back to pending
        await supabaseAdmin
          .from('landlord_subscription_charges')
          .update({ status: 'pending' })
          .eq('landlord_id', landlord_id)
          .eq('status', 'exempted');
      }

      return new Response(
        JSON.stringify({
          success: true,
          exempted: newExempt,
          message: newExempt
            ? 'Propriétaire exonéré des frais Premium. Les impayés en attente ont été annulés.'
            : 'Exonération retirée. Les prélèvements reprendront.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // --- Action: check Stripe balance ---
    if (action === 'check_balance' && landlord_id) {
      return await checkBalance(supabaseAdmin, landlord_id);
    }

    // --- Action: mark subscription as paid manually (invoice sent outside Stripe) ---
    if (action === 'mark_paid') {
      return await markPaid(supabaseAdmin, landlord_id, lease_id, charge_id, body.payment_method || 'invoice', user.id);
    }

    // --- Action: retry a specific failed charge ---
    if (action === 'retry' && charge_id) {
      return await retryCharge(supabaseAdmin, charge_id, user.id);
    }

    // --- Action: retry all failed charges for a landlord ---
    if (action === 'retry_all' && landlord_id) {
      return await retryAllCharges(supabaseAdmin, landlord_id, user.id);
    }

    // --- Default action: charge a specific lease ---
    if (!landlord_id) throw new Error('ID du propriétaire manquant');
    if (!lease_id) throw new Error('ID du bail manquant');

    return await chargeLease(supabaseAdmin, landlord_id, lease_id, user.id);
  } catch (error: any) {
    console.error('Erreur:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// --- Helper: check if landlord is currently exempted ---
function isExempted(profile: any): boolean {
  if (!profile.subscription_exempt) return false;
  if (profile.subscription_exempt_until) {
    return new Date(profile.subscription_exempt_until) > new Date();
  }
  return true;
}

// --- Charge a specific lease ---
async function chargeLease(supabaseAdmin: any, landlord_id: string, lease_id: string, admin_id: string) {
  const { data: landlord, error: landlordError } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, email, stripe_account_id, stripe_charges_enabled, role, subscription_exempt, subscription_exempt_until')
    .eq('id', landlord_id)
    .maybeSingle();

  if (landlordError || !landlord) throw new Error('Propriétaire introuvable');
  if (landlord.role !== 'landlord') throw new Error('Cet utilisateur n\'est pas un propriétaire');
  if (!landlord.stripe_account_id) throw new Error('Ce propriétaire n\'a pas de compte Stripe Connect');
  if (!landlord.stripe_charges_enabled) throw new Error('Le compte Stripe de ce propriétaire n\'est pas activé pour les paiements');

  if (isExempted(landlord)) {
    throw new Error('Ce propriétaire est exonéré des frais Premium. Retirez l\'exonération pour effectuer un prélèvement.');
  }

  const today = new Date().toISOString().split('T')[0];

  const { data: lease, error: leaseError } = await supabaseAdmin
    .from('leases')
    .select('id, start_date, end_date, status, listing_id')
    .eq('id', lease_id)
    .eq('landlord_id', landlord_id)
    .in('status', ['signed', 'active'])
    .gte('end_date', today)
    .maybeSingle();

  if (leaseError) throw new Error('Erreur lors de la vérification du bail');
  if (!lease) throw new Error('Bail introuvable, annulé, ou expiré.');
  if (lease.start_date && lease.start_date > today) {
    throw new Error(`Le bail n'a pas encore commencé. Date de début : ${new Date(lease.start_date).toLocaleDateString('fr-FR')}`);
  }

  const periodMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  // Check for existing charge record
  const { data: existingCharge } = await supabaseAdmin
    .from('landlord_subscription_charges')
    .select('*')
    .eq('landlord_id', landlord_id)
    .eq('lease_id', lease_id)
    .eq('period_month', periodMonth)
    .maybeSingle();

  if (existingCharge && existingCharge.status === 'paid') {
    throw new Error(`Ce bail a déjà été prélevé pour ${periodMonth}.`);
  }

  let listingTitle = '';
  if (lease.listing_id) {
    const { data: listing } = await supabaseAdmin
      .from('listings')
      .select('title')
      .eq('id', lease.listing_id)
      .maybeSingle();
    if (listing) listingTitle = listing.title || '';
  }

  // Check Stripe balance
  const balance = await stripe.balance.retrieve({
    stripeAccount: landlord.stripe_account_id,
  });

  const availableEur = balance.available.find((b: any) => b.currency === 'eur');
  const availableAmount = availableEur ? availableEur.amount : 0;

  if (availableAmount < PREMIUM_AMOUNT) {
    const availableEuros = (availableAmount / 100).toFixed(2);

    // Record or update the failed charge
    if (existingCharge) {
      await supabaseAdmin
        .from('landlord_subscription_charges')
        .update({
          status: 'failed',
          failure_reason: `Solde Stripe insuffisant: ${availableEuros} € disponible`,
          last_attempt_at: new Date().toISOString(),
          attempt_count: (existingCharge.attempt_count || 0) + 1,
        })
        .eq('id', existingCharge.id);
    } else {
      await supabaseAdmin
        .from('landlord_subscription_charges')
        .insert({
          landlord_id,
          lease_id,
          listing_id: lease.listing_id,
          period_month: periodMonth,
          amount: PREMIUM_AMOUNT,
          status: 'failed',
          failure_reason: `Solde Stripe insuffisant: ${availableEuros} € disponible`,
          last_attempt_at: new Date().toISOString(),
          attempt_count: 1,
        });
    }

    throw new Error(
      `Solde Stripe insuffisant. Disponible: ${availableEuros} €. Le prélèvement sera retenté automatiquement quand le loyer sera payé.`
    );
  }

  // Debit the connected account
  const charge = await stripe.charges.create({
    amount: PREMIUM_AMOUNT,
    currency: 'eur',
    description: `Abonnement Hellofonty Premium (59€) — Bail: ${listingTitle || lease.id.slice(0, 8)} — ${new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })}`,
    metadata: {
      landlord_id,
      type: 'premium_subscription',
      lease_id,
      lease_end_date: lease.end_date,
      charged_by_admin: admin_id,
    },
  }, {
    stripeAccount: landlord.stripe_account_id,
    idempotencyKey: `lease_charge_${lease_id}_${periodMonth}`,
  });

  const now = new Date().toISOString();

  // Upsert charge record as paid
  if (existingCharge) {
    await supabaseAdmin
      .from('landlord_subscription_charges')
      .update({
        status: 'paid',
        stripe_charge_id: charge.id,
        paid_at: now,
        last_attempt_at: now,
        attempt_count: (existingCharge.attempt_count || 0) + 1,
        failure_reason: null,
      })
      .eq('id', existingCharge.id);
  } else {
    await supabaseAdmin
      .from('landlord_subscription_charges')
      .insert({
        landlord_id,
        lease_id,
        listing_id: lease.listing_id,
        period_month: periodMonth,
        amount: PREMIUM_AMOUNT,
        status: 'paid',
        stripe_charge_id: charge.id,
        paid_at: now,
        last_attempt_at: now,
        attempt_count: 1,
      });
  }

  // Update subscription
  const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const periodEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

  await supabaseAdmin
    .from('subscriptions')
    .upsert({
      user_id: landlord_id,
      plan_type: 'premium',
      status: 'active',
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
    }, { onConflict: 'user_id' });

  // Record invoice
  await supabaseAdmin
    .from('invoices')
    .insert({
      user_id: landlord_id,
      stripe_invoice_id: `manual_${charge.id}`,
      amount: PREMIUM_AMOUNT,
      currency: 'eur',
      status: 'paid',
      billing_reason: 'manual_admin_charge',
      lease_id,
    });

  return new Response(
    JSON.stringify({
      success: true,
      charge_id: charge.id,
      amount: PREMIUM_AMOUNT,
      currency: 'eur',
      landlord_name: `${landlord.first_name} ${landlord.last_name}`,
      lease_id,
      listing_title: listingTitle,
      message: `Prélèvement de 59,00 € effectué sur le solde Stripe du propriétaire pour le bail « ${listingTitle || 'sans titre'} ».`,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// --- Retry a single failed charge ---
async function retryCharge(supabaseAdmin: any, chargeId: string, adminId: string) {
  const { data: chargeRecord, error: recErr } = await supabaseAdmin
    .from('landlord_subscription_charges')
    .select('*')
    .eq('id', chargeId)
    .maybeSingle();

  if (recErr || !chargeRecord) throw new Error('Prélèvement introuvable');
  if (chargeRecord.status === 'paid') throw new Error('Ce prélèvement est déjà payé');
  if (chargeRecord.status === 'exempted') throw new Error('Ce prélèvement est exonéré');

  const { data: landlord } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, stripe_account_id, stripe_charges_enabled, subscription_exempt, subscription_exempt_until')
    .eq('id', chargeRecord.landlord_id)
    .maybeSingle();

  if (!landlord) throw new Error('Propriétaire introuvable');
  if (!landlord.stripe_account_id || !landlord.stripe_charges_enabled) {
    throw new Error('Compte Stripe non configuré');
  }
  if (isExempted(landlord)) throw new Error('Ce propriétaire est exonéré');

  const balance = await stripe.balance.retrieve({
    stripeAccount: landlord.stripe_account_id,
  });
  const availableEur = balance.available.find((b: any) => b.currency === 'eur');
  const availableAmount = availableEur ? availableEur.amount : 0;

  if (availableAmount < chargeRecord.amount) {
    const availableEuros = (availableAmount / 100).toFixed(2);
    await supabaseAdmin
      .from('landlord_subscription_charges')
      .update({
        status: 'failed',
        failure_reason: `Solde Stripe insuffisant: ${availableEuros} € disponible`,
        last_attempt_at: new Date().toISOString(),
        attempt_count: (chargeRecord.attempt_count || 0) + 1,
      })
      .eq('id', chargeId);

    throw new Error(`Solde Stripe insuffisant: ${availableEuros} € disponible. Réessayez le mois prochain.`);
  }

  const charge = await stripe.charges.create({
    amount: chargeRecord.amount,
    currency: 'eur',
    description: `Abonnement Hellofonty Premium — ${chargeRecord.period_month} — Retry`,
    metadata: {
      landlord_id: chargeRecord.landlord_id,
      type: 'premium_subscription_retry',
      lease_id: chargeRecord.lease_id,
      period_month: chargeRecord.period_month,
      charged_by_admin: adminId,
    },
  }, {
    stripeAccount: landlord.stripe_account_id,
    idempotencyKey: `retry_${chargeRecord.id}_${chargeRecord.attempt_count || 0}`,
  });

  const now = new Date().toISOString();
  await supabaseAdmin
    .from('landlord_subscription_charges')
    .update({
      status: 'paid',
      stripe_charge_id: charge.id,
      paid_at: now,
      last_attempt_at: now,
      attempt_count: (chargeRecord.attempt_count || 0) + 1,
      failure_reason: null,
    })
    .eq('id', chargeId);

  // Record invoice
  await supabaseAdmin
    .from('invoices')
    .insert({
      user_id: chargeRecord.landlord_id,
      stripe_invoice_id: `retry_${charge.id}`,
      amount: chargeRecord.amount,
      currency: 'eur',
      status: 'paid',
      billing_reason: 'manual_retry_charge',
      lease_id: chargeRecord.lease_id,
    });

  return new Response(
    JSON.stringify({
      success: true,
      charge_id: charge.id,
      message: `Prélèvement de ${(chargeRecord.amount / 100).toFixed(2)} € récupéré avec succès pour ${chargeRecord.period_month}.`,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// --- Retry all failed charges for a landlord ---
async function retryAllCharges(supabaseAdmin: any, landlordId: string, adminId: string) {
  const { data: failedCharges } = await supabaseAdmin
    .from('landlord_subscription_charges')
    .select('*')
    .eq('landlord_id', landlordId)
    .eq('status', 'failed')
    .order('period_month', { ascending: true });

  if (!failedCharges || failedCharges.length === 0) {
    return new Response(
      JSON.stringify({ success: true, message: 'Aucun impayé à récupérer.', recovered: 0 }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: landlord } = await supabaseAdmin
    .from('profiles')
    .select('stripe_account_id, stripe_charges_enabled, subscription_exempt, subscription_exempt_until')
    .eq('id', landlordId)
    .maybeSingle();

  if (!landlord?.stripe_account_id || !landlord?.stripe_charges_enabled) {
    throw new Error('Compte Stripe non configuré');
  }
  if (isExempted(landlord)) throw new Error('Ce propriétaire est exonéré');

  const balance = await stripe.balance.retrieve({
    stripeAccount: landlord.stripe_account_id,
  });
  const availableEur = balance.available.find((b: any) => b.currency === 'eur');
  const availableAmount = availableEur ? availableEur.amount : 0;

  const totalNeeded = failedCharges.reduce((sum: number, c: any) => sum + c.amount, 0);

  if (availableAmount < totalNeeded) {
    const availableEuros = (availableAmount / 100).toFixed(2);
    const neededEuros = (totalNeeded / 100).toFixed(2);
    throw new Error(
      `Solde insuffisant pour récupérer tous les impayés. ` +
      `Disponible: ${availableEuros} €, nécessaire: ${neededEuros} €. ` +
      `Récupération partielle en cours...`
    );
  }

  let recovered = 0;
  let totalRecovered = 0;
  const errors: string[] = [];

  for (const fc of failedCharges) {
    try {
      const charge = await stripe.charges.create({
        amount: fc.amount,
        currency: 'eur',
        description: `Abonnement Premium — ${fc.period_month} — Retry`,
        metadata: {
          landlord_id: landlordId,
          type: 'premium_subscription_retry',
          lease_id: fc.lease_id,
          period_month: fc.period_month,
          charged_by_admin: adminId,
        },
      }, {
        stripeAccount: landlord.stripe_account_id,
        idempotencyKey: `retry_${fc.id}_${fc.attempt_count || 0}`,
      });

      const now = new Date().toISOString();
      await supabaseAdmin
        .from('landlord_subscription_charges')
        .update({
          status: 'paid',
          stripe_charge_id: charge.id,
          paid_at: now,
          last_attempt_at: now,
          attempt_count: (fc.attempt_count || 0) + 1,
          failure_reason: null,
        })
        .eq('id', fc.id);

      await supabaseAdmin
        .from('invoices')
        .insert({
          user_id: landlordId,
          stripe_invoice_id: `retry_${charge.id}`,
          amount: fc.amount,
          currency: 'eur',
          status: 'paid',
          billing_reason: 'manual_retry_charge',
          lease_id: fc.lease_id,
        });

      recovered++;
      totalRecovered += fc.amount;
    } catch (err: any) {
      errors.push(`${fc.period_month}: ${err.message}`);
      await supabaseAdmin
        .from('landlord_subscription_charges')
        .update({
          failure_reason: err.message,
          last_attempt_at: new Date().toISOString(),
          attempt_count: (fc.attempt_count || 0) + 1,
        })
        .eq('id', fc.id);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      recovered,
      total_recovered: totalRecovered,
      errors,
      message: `${recovered} prélèvement${recovered > 1 ? 's' : ''} récupéré${recovered > 1 ? 's' : ''} (${(totalRecovered / 100).toFixed(2)} €).`,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// --- Check landlord Stripe balance ---
async function checkBalance(supabaseAdmin: any, landlordId: string) {
  const { data: landlord, error: landlordError } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled')
    .eq('id', landlordId)
    .maybeSingle();

  if (landlordError || !landlord) throw new Error('Propriétaire introuvable');
  if (!landlord.stripe_account_id) throw new Error('Ce propriétaire n\'a pas de compte Stripe Connect');

  const balance = await stripe.balance.retrieve({
    stripeAccount: landlord.stripe_account_id,
  });

  const availableEur = balance.available.find((b: any) => b.currency === 'eur');
  const pendingEur = balance.pending.find((b: any) => b.currency === 'eur');

  const availableAmount = availableEur ? availableEur.amount : 0;
  const pendingAmount = pendingEur ? pendingEur.amount : 0;

  // Also fetch unpaid charges total
  const { data: unpaidCharges } = await supabaseAdmin
    .from('landlord_subscription_charges')
    .select('amount')
    .eq('landlord_id', landlordId)
    .in('status', ['failed', 'pending']);

  const unpaidTotal = (unpaidCharges || []).reduce((sum: number, c: any) => sum + c.amount, 0);

  // Also update account status
  const account = await stripe.accounts.retrieve(landlord.stripe_account_id);
  const chargesEnabled = account.charges_enabled || false;
  const payoutsEnabled = account.payouts_enabled || false;
  const detailsSubmitted = account.details_submitted || false;

  let onboardingStatus = 'pending';
  if (payoutsEnabled) onboardingStatus = 'complete';
  else if (!detailsSubmitted) onboardingStatus = 'pending';

  await supabaseAdmin
    .from('profiles')
    .update({
      stripe_details_submitted: detailsSubmitted,
      stripe_charges_enabled: chargesEnabled,
      stripe_payouts_enabled: payoutsEnabled,
      stripe_onboarding_status: onboardingStatus,
      stripe_onboarding_updated_at: new Date().toISOString(),
    })
    .eq('id', landlordId);

  return new Response(
    JSON.stringify({
      success: true,
      balance: {
        available: availableAmount,
        pending: pendingAmount,
        currency: 'eur',
        available_euros: (availableAmount / 100).toFixed(2),
        pending_euros: (pendingAmount / 100).toFixed(2),
      },
      account_status: {
        charges_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
        details_submitted: detailsSubmitted,
        onboarding_status: onboardingStatus,
      },
      unpaid_charges: {
        count: (unpaidCharges || []).length,
        total: unpaidTotal,
        total_euros: (unpaidTotal / 100).toFixed(2),
      },
      landlord_name: `${landlord.first_name} ${landlord.last_name}`,
      can_charge: availableAmount >= PREMIUM_AMOUNT,
      message: availableAmount >= PREMIUM_AMOUNT
        ? `Solde suffisant: ${(availableAmount / 100).toFixed(2)} € disponible. Prélèvement possible.`
        : `Solde insuffisant: ${(availableAmount / 100).toFixed(2)} € disponible. Le prélèvement de 59,00 € échouera.`,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// --- Mark subscription as paid manually (no Stripe, invoice sent directly) ---
async function markPaid(supabaseAdmin: any, landlord_id: string | undefined, lease_id: string | undefined, charge_id: string | undefined, paymentMethod: string, admin_id: string) {
  if (!landlord_id) throw new Error('ID du propriétaire manquant');

  const { data: landlord } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, role')
    .eq('id', landlord_id)
    .maybeSingle();

  if (!landlord) throw new Error('Propriétaire introuvable');

  const now = new Date().toISOString();
  const periodMonth = new Date().toISOString().slice(0, 7);

  // Case 1: marking a specific unpaid charge as paid
  if (charge_id) {
    const { data: chargeRecord, error: recErr } = await supabaseAdmin
      .from('landlord_subscription_charges')
      .select('*')
      .eq('id', charge_id)
      .maybeSingle();

    if (recErr || !chargeRecord) throw new Error('Prélèvement introuvable');
    if (chargeRecord.status === 'paid') throw new Error('Ce prélèvement est déjà payé');

    await supabaseAdmin
      .from('landlord_subscription_charges')
      .update({
        status: 'paid',
        paid_at: now,
        last_attempt_at: now,
        failure_reason: null,
      })
      .eq('id', charge_id);

    await supabaseAdmin
      .from('invoices')
      .insert({
        user_id: chargeRecord.landlord_id,
        stripe_invoice_id: `manual_mark_${charge_id}`,
        amount: chargeRecord.amount,
        currency: 'eur',
        status: 'paid',
        billing_reason: `manual_mark_paid_${paymentMethod}`,
        lease_id: chargeRecord.lease_id,
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Prélèvement de ${(chargeRecord.amount / 100).toFixed(2)} € pour ${chargeRecord.period_month} marqué comme payé (${paymentMethod}).`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Case 2: marking a lease as paid for the current month
  if (!lease_id) throw new Error('ID du bail manquant');

  const { data: lease, error: leaseError } = await supabaseAdmin
    .from('leases')
    .select('id, start_date, end_date, status, listing_id')
    .eq('id', lease_id)
    .eq('landlord_id', landlord_id)
    .in('status', ['signed', 'active'])
    .maybeSingle();

  if (leaseError || !lease) throw new Error('Bail introuvable ou inactif');

  let listingTitle = '';
  if (lease.listing_id) {
    const { data: listing } = await supabaseAdmin
      .from('listings')
      .select('title')
      .eq('id', lease.listing_id)
      .maybeSingle();
    if (listing) listingTitle = listing.title || '';
  }

  const { data: existingCharge } = await supabaseAdmin
    .from('landlord_subscription_charges')
    .select('*')
    .eq('landlord_id', landlord_id)
    .eq('lease_id', lease_id)
    .eq('period_month', periodMonth)
    .maybeSingle();

  if (existingCharge && existingCharge.status === 'paid') {
    throw new Error(`Ce bail a déjà été payé pour ${periodMonth}.`);
  }

  if (existingCharge) {
    await supabaseAdmin
      .from('landlord_subscription_charges')
      .update({
        status: 'paid',
        paid_at: now,
        last_attempt_at: now,
        failure_reason: null,
      })
      .eq('id', existingCharge.id);
  } else {
    await supabaseAdmin
      .from('landlord_subscription_charges')
      .insert({
        landlord_id,
        lease_id,
        listing_id: lease.listing_id,
        period_month: periodMonth,
        amount: PREMIUM_AMOUNT,
        status: 'paid',
        paid_at: now,
        last_attempt_at: now,
        attempt_count: 1,
      });
  }

  // Update subscription as active
  const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const periodEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

  await supabaseAdmin
    .from('subscriptions')
    .upsert({
      user_id: landlord_id,
      plan_type: 'premium',
      status: 'active',
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
    }, { onConflict: 'user_id' });

  await supabaseAdmin
    .from('invoices')
    .insert({
      user_id: landlord_id,
      stripe_invoice_id: `manual_mark_${lease_id}_${periodMonth}`,
      amount: PREMIUM_AMOUNT,
      currency: 'eur',
      status: 'paid',
      billing_reason: `manual_mark_paid_${paymentMethod}`,
      lease_id,
    });

  return new Response(
    JSON.stringify({
      success: true,
      landlord_name: `${landlord.first_name} ${landlord.last_name}`,
      lease_id,
      listing_title: listingTitle,
      message: `Abonnement de 59,00 € marqué comme payé (${paymentMethod}) pour le bail « ${listingTitle || 'sans titre'} » — ${periodMonth}.`,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
