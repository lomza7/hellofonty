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

  // This function is called by pg_cron and should not require auth
  // But we also allow manual admin trigger
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all landlords with premium subscriptions
    const { data: premiumLandlords, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select(`
        user_id,
        current_period_end,
        profiles!inner(id, stripe_account_id, stripe_charges_enabled, first_name, last_name)
      `)
      .eq('plan_type', 'premium')
      .eq('status', 'active');

    if (subError) {
      throw new Error(`Erreur lors de la récupération des abonnements: ${subError.message}`);
    }

    if (!premiumLandlords || premiumLandlords.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Aucun abonnement Premium actif', charged: 0, suspended: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const results: { charged: string[]; suspended: string[]; errors: string[] } = {
      charged: [],
      suspended: [],
      errors: [],
    };

    for (const sub of premiumLandlords) {
      const landlord = sub.profiles as any;

      if (!landlord.stripe_account_id || !landlord.stripe_charges_enabled) {
        results.errors.push(`${landlord.first_name} ${landlord.last_name}: compte Stripe non configuré`);
        continue;
      }

      // Check if already charged this month
      const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
      if (periodEnd && periodEnd > new Date()) {
        // Current period still active — skip
        continue;
      }

      // Check for active lease with end_date in the future
      const { data: activeLease, error: leaseError } = await supabaseAdmin
        .from('leases')
        .select('id, end_date')
        .eq('landlord_id', sub.user_id)
        .eq('status', 'active')
        .gte('end_date', today)
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (leaseError) {
        results.errors.push(`${landlord.first_name} ${landlord.last_name}: erreur bail`);
        continue;
      }

      if (!activeLease) {
        // Contract ended — suspend subscription
        await supabaseAdmin
          .from('subscriptions')
          .update({
            plan_type: 'free',
            status: 'active',
            current_period_end: null,
          })
          .eq('user_id', sub.user_id);

        results.suspended.push(`${landlord.first_name} ${landlord.last_name}`);
        continue;
      }

      try {
        // Charge the landlord's Stripe Connect account
        const charge = await stripe.charges.create({
          amount: PREMIUM_AMOUNT,
          currency: 'eur',
          description: `Abonnement Hellofonty Premium - ${new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })}`,
          metadata: {
            landlord_id: sub.user_id,
            type: 'premium_subscription',
            lease_id: activeLease.id,
            lease_end_date: activeLease.end_date,
            auto_charge: 'true',
          },
        }, {
          stripeAccount: landlord.stripe_account_id,
        });

        // Update subscription period
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const periodEndNew = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        await supabaseAdmin
          .from('subscriptions')
          .update({
            plan_type: 'premium',
            status: 'active',
            current_period_start: periodStart.toISOString(),
            current_period_end: periodEndNew.toISOString(),
          })
          .eq('user_id', sub.user_id);

        // Record invoice
        await supabaseAdmin
          .from('invoices')
          .insert({
            user_id: sub.user_id,
            stripe_invoice_id: `auto_${charge.id}`,
            amount: PREMIUM_AMOUNT,
            currency: 'eur',
            status: 'paid',
            billing_reason: 'automatic_monthly_charge',
          });

        results.charged.push(`${landlord.first_name} ${landlord.last_name}`);
      } catch (chargeError: any) {
        results.errors.push(`${landlord.first_name} ${landlord.last_name}: ${chargeError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        charged: results.charged.length,
        suspended: results.suspended.length,
        errors: results.errors.length,
        details: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Erreur cron:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
