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
    const { landlord_id, lease_id } = body;

    if (!landlord_id) {
      throw new Error('ID du propriétaire manquant');
    }

    if (!lease_id) {
      throw new Error('ID du bail manquant');
    }

    // Get landlord profile with Stripe account info
    const { data: landlord, error: landlordError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, stripe_account_id, stripe_charges_enabled, role')
      .eq('id', landlord_id)
      .maybeSingle();

    if (landlordError || !landlord) {
      throw new Error('Propriétaire introuvable');
    }

    if (landlord.role !== 'landlord') {
      throw new Error('Cet utilisateur n\'est pas un propriétaire');
    }

    if (!landlord.stripe_account_id) {
      throw new Error('Ce propriétaire n\'a pas de compte Stripe Connect');
    }

    if (!landlord.stripe_charges_enabled) {
      throw new Error('Le compte Stripe de ce propriétaire n\'est pas activé pour les paiements');
    }

    const today = new Date().toISOString().split('T')[0];

    // Fetch the specific lease — must be signed or active, belong to this landlord, end in the future
    const { data: lease, error: leaseError } = await supabaseAdmin
      .from('leases')
      .select('id, start_date, end_date, status, listing_id')
      .eq('id', lease_id)
      .eq('landlord_id', landlord_id)
      .in('status', ['signed', 'active'])
      .gte('end_date', today)
      .maybeSingle();

    if (leaseError) {
      throw new Error('Erreur lors de la vérification du bail');
    }

    if (!lease) {
      throw new Error('Bail introuvable, annulé, ou expiré. Seuls les baux signés ou actifs avec une date de fin future peuvent être prélevés.');
    }

    // Check that the lease has already started (start_date <= today)
    if (lease.start_date && lease.start_date > today) {
      throw new Error(`Le bail n'a pas encore commencé. Date de début du bail : ${new Date(lease.start_date).toLocaleDateString('fr-FR')}`);
    }

    // Prevent double charge: check if an invoice already exists for this lease
    const { data: existingInvoice } = await supabaseAdmin
      .from('invoices')
      .select('id, stripe_invoice_id, created_at')
      .eq('user_id', landlord_id)
      .eq('lease_id', lease_id)
      .eq('status', 'paid')
      .ilike('billing_reason', 'manual_admin_charge')
      .maybeSingle();

    if (existingInvoice) {
      throw new Error(`Ce bail a déjà été prélevé (paiement du ${new Date(existingInvoice.created_at).toLocaleDateString('fr-FR')}). Un seul prélèvement de 59 € par bail est autorisé.`);
    }

    const leaseEndDate = lease.end_date as string;

    // Get listing title for the charge description
    let listingTitle = '';
    if (lease.listing_id) {
      const { data: listing } = await supabaseAdmin
        .from('listings')
        .select('title')
        .eq('id', lease.listing_id)
        .maybeSingle();
      if (listing) listingTitle = listing.title || '';
    }

    // Use the landlord's platform Stripe customer and its saved payment method.
    const { data: stripeCustomer, error: customerError } = await supabaseAdmin
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', landlord_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (customerError) {
      throw new Error('Erreur lors de la récupération du client Stripe');
    }

    if (!stripeCustomer?.customer_id) {
      throw new Error('Ce propriétaire n\'a pas encore de client Stripe. Il doit d\'abord enregistrer un moyen de paiement.');
    }

    // The customer belongs to the platform account, so the charge is created there.
    const charge = await stripe.charges.create({
      amount: PREMIUM_AMOUNT,
      currency: 'eur',
      customer: stripeCustomer.customer_id,
      description: `Abonnement Hellofonty Premium (59€) — Bail: ${listingTitle || lease.id.slice(0, 8)} — ${new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })}`,
      metadata: {
        landlord_id: landlord_id,
        type: 'premium_subscription',
        lease_id: lease_id,
        lease_end_date: leaseEndDate,
        charged_by_admin: user.id,
      },
    }, {
      idempotencyKey: `manual_lease_charge_${lease_id}`,
    });

    // Calculate period dates: current month start, end of month
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Update subscription to premium
    const { error: subError } = await supabaseAdmin
      .from('subscriptions')
      .upsert({
        user_id: landlord_id,
        plan_type: 'premium',
        status: 'active',
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
      }, { onConflict: 'user_id' });

    if (subError) {
      console.error('Error updating subscription:', subError);
    }

    // Record invoice with lease_id to prevent double charges
    const invoiceId = `manual_${charge.id}`;
    const { error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .insert({
        user_id: landlord_id,
        stripe_invoice_id: invoiceId,
        amount: PREMIUM_AMOUNT,
        currency: 'eur',
        status: 'paid',
        billing_reason: 'manual_admin_charge',
        lease_id: lease_id,
      });

    if (invoiceError) {
      console.error('Error inserting invoice:', invoiceError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        charge_id: charge.id,
        amount: PREMIUM_AMOUNT,
        currency: 'eur',
        landlord_name: `${landlord.first_name} ${landlord.last_name}`,
        lease_id: lease_id,
        lease_end_date: leaseEndDate,
        listing_title: listingTitle,
        message: `Prélèvement de 59,00 € effectué pour le bail « ${listingTitle || 'sans titre'} ». Abonnement Premium actif jusqu'au ${periodEnd.toLocaleDateString('fr-FR')}. Le contrat se termine le ${new Date(leaseEndDate).toLocaleDateString('fr-FR')}.`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Erreur:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
