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

function isExempted(profile: any): boolean {
  if (!profile.subscription_exempt) return false;
  if (profile.subscription_exempt_until) {
    return new Date(profile.subscription_exempt_until) > new Date();
  }
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const today = new Date().toISOString().split('T')[0];
    const periodMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    const results: { charged: string[]; retried: string[]; suspended: string[]; errors: string[]; exempted: string[] } = {
      charged: [],
      retried: [],
      suspended: [],
      errors: [],
      exempted: [],
    };

    // 1. Get all landlords with active or signed leases ending in the future
    const { data: activeLeases, error: leaseError } = await supabaseAdmin
      .from('leases')
      .select(`
        id, landlord_id, start_date, end_date, status, listing_id,
        landlord:profiles!landlord_id(id, first_name, last_name, stripe_account_id, stripe_charges_enabled,
          subscription_exempt, subscription_exempt_until)
      `)
      .in('status', ['signed', 'active'])
      .gte('end_date', today);

    if (leaseError) {
      throw new Error(`Erreur lors de la récupération des baux: ${leaseError.message}`);
    }

    if (!activeLeases || activeLeases.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Aucun bail actif', charged: 0, retried: 0, exempted: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group by landlord to avoid duplicate charges
    const landlordMap = new Map<string, { landlord: any; leases: any[] }>();

    for (const lease of activeLeases) {
      const landlord = lease.landlord as any;
      if (!landlord) continue;

      // Skip if lease hasn't started yet
      if (lease.start_date && lease.start_date > today) continue;

      if (!landlordMap.has(landlord.id)) {
        landlordMap.set(landlord.id, { landlord, leases: [] });
      }
      landlordMap.get(landlord.id)!.leases.push(lease);
    }

    for (const [landlordId, { landlord, leases }] of landlordMap) {
      const landlordName = `${landlord.first_name} ${landlord.last_name}`;

      // Skip exempted landlords
      if (isExempted(landlord)) {
        results.exempted.push(landlordName);
        continue;
      }

      if (!landlord.stripe_account_id || !landlord.stripe_charges_enabled) {
        results.errors.push(`${landlordName}: compte Stripe non configuré`);
        continue;
      }

      // 2. Retry previously failed charges first
      const { data: failedCharges } = await supabaseAdmin
        .from('landlord_subscription_charges')
        .select('*')
        .eq('landlord_id', landlordId)
        .eq('status', 'failed')
        .order('period_month', { ascending: true });

      if (failedCharges && failedCharges.length > 0) {
        try {
          const balance = await stripe.balance.retrieve({
            stripeAccount: landlord.stripe_account_id,
          });
          const availableEur = balance.available.find((b: any) => b.currency === 'eur');
          const availableAmount = availableEur ? availableEur.amount : 0;

          for (const fc of failedCharges) {
            if (availableAmount < fc.amount) {
              // Still not enough balance — skip, will retry next month
              results.errors.push(`${landlordName}: impayé ${fc.period_month} — solde insuffisant`);
              continue;
            }

            try {
              const charge = await stripe.charges.create({
                amount: fc.amount,
                currency: 'eur',
                description: `Abonnement Premium — ${fc.period_month} — Retry auto`,
                metadata: {
                  landlord_id: landlordId,
                  type: 'premium_subscription_auto_retry',
                  lease_id: fc.lease_id,
                  period_month: fc.period_month,
                },
              }, {
                stripeAccount: landlord.stripe_account_id,
                idempotencyKey: `auto_retry_${fc.id}_${fc.attempt_count || 0}`,
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
                  stripe_invoice_id: `auto_retry_${charge.id}`,
                  amount: fc.amount,
                  currency: 'eur',
                  status: 'paid',
                  billing_reason: 'automatic_retry_charge',
                  lease_id: fc.lease_id,
                });

              results.retried.push(`${landlordName} (${fc.period_month})`);
            } catch (err: any) {
              results.errors.push(`${landlordName}: retry ${fc.period_month} — ${err.message}`);
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
        } catch (err: any) {
          results.errors.push(`${landlordName}: vérification solde — ${err.message}`);
        }
      }

      // 3. Create new monthly charge for current period if not already exists
      // Use the first active lease for this landlord
      const primaryLease = leases[0];

      const { data: existingCharge } = await supabaseAdmin
        .from('landlord_subscription_charges')
        .select('id, status')
        .eq('landlord_id', landlordId)
        .eq('period_month', periodMonth)
        .maybeSingle();

      if (existingCharge) {
        // Already has a charge record for this month — skip
        continue;
      }

      // Check subscription period to avoid double-charging
      const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('current_period_end')
        .eq('user_id', landlordId)
        .maybeSingle();

      const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
      if (periodEnd && periodEnd > new Date()) {
        // Current subscription period still active — skip
        continue;
      }

      // Create a pending charge record
      let listingTitle = '';
      if (primaryLease.listing_id) {
        const { data: listing } = await supabaseAdmin
          .from('listings')
          .select('title')
          .eq('id', primaryLease.listing_id)
          .maybeSingle();
        if (listing) listingTitle = listing.title || '';
      }

      try {
        const balance = await stripe.balance.retrieve({
          stripeAccount: landlord.stripe_account_id,
        });
        const availableEur = balance.available.find((b: any) => b.currency === 'eur');
        const availableAmount = availableEur ? availableEur.amount : 0;

        if (availableAmount < PREMIUM_AMOUNT) {
          // Record as failed — will be retried next month
          await supabaseAdmin
            .from('landlord_subscription_charges')
            .insert({
              landlord_id: landlordId,
              lease_id: primaryLease.id,
              listing_id: primaryLease.listing_id,
              period_month: periodMonth,
              amount: PREMIUM_AMOUNT,
              status: 'failed',
              failure_reason: `Solde Stripe insuffisant: ${(availableAmount / 100).toFixed(2)} € disponible`,
              last_attempt_at: new Date().toISOString(),
              attempt_count: 1,
            });

          results.errors.push(`${landlordName}: solde insuffisant pour ${periodMonth} — impayé créé`);
          continue;
        }

        const charge = await stripe.charges.create({
          amount: PREMIUM_AMOUNT,
          currency: 'eur',
          description: `Abonnement Hellofonty Premium — ${periodMonth}`,
          metadata: {
            landlord_id: landlordId,
            type: 'premium_subscription',
            lease_id: primaryLease.id,
            period_month: periodMonth,
            auto_charge: 'true',
          },
        }, {
          stripeAccount: landlord.stripe_account_id,
          idempotencyKey: `auto_charge_${landlordId}_${periodMonth}`,
        });

        const now = new Date().toISOString();
        await supabaseAdmin
          .from('landlord_subscription_charges')
          .insert({
            landlord_id: landlordId,
            lease_id: primaryLease.id,
            listing_id: primaryLease.listing_id,
            period_month: periodMonth,
            amount: PREMIUM_AMOUNT,
            status: 'paid',
            stripe_charge_id: charge.id,
            paid_at: now,
            last_attempt_at: now,
            attempt_count: 1,
          });

        // Update subscription period
        const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const periodEndNew = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

        await supabaseAdmin
          .from('subscriptions')
          .upsert({
            user_id: landlordId,
            plan_type: 'premium',
            status: 'active',
            current_period_start: periodStart.toISOString(),
            current_period_end: periodEndNew.toISOString(),
            cancel_at_period_end: false,
          }, { onConflict: 'user_id' });

        await supabaseAdmin
          .from('invoices')
          .insert({
            user_id: landlordId,
            stripe_invoice_id: `auto_${charge.id}`,
            amount: PREMIUM_AMOUNT,
            currency: 'eur',
            status: 'paid',
            billing_reason: 'automatic_monthly_charge',
            lease_id: primaryLease.id,
          });

        results.charged.push(landlordName);
      } catch (err: any) {
        // Record as failed
        await supabaseAdmin
          .from('landlord_subscription_charges')
          .insert({
            landlord_id: landlordId,
            lease_id: primaryLease.id,
            listing_id: primaryLease.listing_id,
            period_month: periodMonth,
            amount: PREMIUM_AMOUNT,
            status: 'failed',
            failure_reason: err.message,
            last_attempt_at: new Date().toISOString(),
            attempt_count: 1,
          });

        results.errors.push(`${landlordName}: ${err.message}`);
      }
    }

    // 4. Suspend subscriptions for landlords with no active lease
    const { data: premiumSubs } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id')
      .eq('plan_type', 'premium')
      .eq('status', 'active');

    if (premiumSubs) {
      for (const sub of premiumSubs) {
        const hasActiveLease = Array.from(landlordMap.keys()).includes(sub.user_id);
        if (!hasActiveLease) {
          await supabaseAdmin
            .from('subscriptions')
            .update({
              plan_type: 'free',
              status: 'active',
              current_period_end: null,
            })
            .eq('user_id', sub.user_id);

          results.suspended.push(sub.user_id);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        charged: results.charged.length,
        retried: results.retried.length,
        suspended: results.suspended.length,
        exempted: results.exempted.length,
        errors: results.errors.length,
        details: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Erreur cron:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
