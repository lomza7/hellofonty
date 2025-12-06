import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import Stripe from 'npm:stripe@14.11.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY non configurée');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    let event: Stripe.Event;

    if (stripeWebhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
      } catch (err) {
        console.error('Erreur vérification signature webhook:', err);
        return new Response(
          JSON.stringify({ success: false, error: 'Signature invalide' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      event = JSON.parse(body);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (event.type === 'account.updated') {
      const account = event.data.object as Stripe.Account;
      
      const { data: profile, error: findError } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_account_id', account.id)
        .maybeSingle();

      if (findError || !profile) {
        console.error('Compte Stripe non trouvé en DB:', account.id);
        return new Response(
          JSON.stringify({ success: true, message: 'Compte non trouvé en DB' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const detailsSubmitted = account.details_submitted || false;
      const chargesEnabled = account.charges_enabled || false;
      const payoutsEnabled = account.payouts_enabled || false;

      let onboardingStatus = 'pending';
      if (payoutsEnabled) {
        onboardingStatus = 'complete';
      } else if (!detailsSubmitted) {
        onboardingStatus = 'pending';
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          stripe_details_submitted: detailsSubmitted,
          stripe_charges_enabled: chargesEnabled,
          stripe_payouts_enabled: payoutsEnabled,
          stripe_onboarding_status: onboardingStatus,
          stripe_onboarding_updated_at: new Date().toISOString(),
        })
        .eq('stripe_account_id', account.id);

      if (updateError) {
        console.error('Erreur mise à jour via webhook:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erreur mise à jour' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Compte Stripe ${account.id} mis à jour - Statut: ${onboardingStatus}`);
    }

    return new Response(
      JSON.stringify({ success: true, received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erreur stripe-webhook:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
