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
    const { landlord_id } = body;

    if (!landlord_id) {
      throw new Error('ID du propriétaire manquant');
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

    // Check that the landlord has at least one active lease with end_date in the future
    const { data: activeLease, error: leaseError } = await supabaseAdmin
      .from('leases')
      .select('id, end_date, status')
      .eq('landlord_id', landlord_id)
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString().split('T')[0])
      .order('end_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (leaseError) {
      throw new Error('Erreur lors de la vérification du bail');
    }

    if (!activeLease) {
      // No active lease — suspend subscription and refuse charge
      await supabaseAdmin
        .from('subscriptions')
        .upsert({
          user_id: landlord_id,
          plan_type: 'free',
          status: 'active',
        }, { onConflict: 'user_id' });

      throw new Error('Aucun bail actif trouvé. L\'abonnement a été suspendu automatiquement car le contrat est terminé.');
    }

    const leaseEndDate = activeLease.end_date as string;

    // Create a direct charge on the landlord's Stripe Connect account
    const charge = await stripe.charges.create({
      amount: PREMIUM_AMOUNT,
      currency: 'eur',
      description: `Abonnement Hellofonty Premium - ${new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })}`,
      metadata: {
        landlord_id: landlord_id,
        type: 'premium_subscription',
        lease_id: activeLease.id,
        lease_end_date: leaseEndDate,
        charged_by_admin: user.id,
      },
    }, {
      stripeAccount: landlord.stripe_account_id,
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

    // Record invoice
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
        lease_end_date: leaseEndDate,
        message: `Prélèvement de 59,00 € effectué sur le compte Stripe du propriétaire. Abonnement Premium actif jusqu'au ${periodEnd.toLocaleDateString('fr-FR')}. Le contrat se termine le ${new Date(leaseEndDate).toLocaleDateString('fr-FR')}.`,
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
