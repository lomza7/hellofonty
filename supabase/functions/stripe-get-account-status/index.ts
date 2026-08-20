import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import Stripe from 'npm:stripe@14.11.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY non configurée');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Non authentifié');
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Non authentifié');
    }

    let body: { account_id?: string; target_user_id?: string } = {};
    try {
      body = await req.json();
    } catch {
      // No body or invalid JSON — continue with caller's own account
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    let targetStripeAccountId: string;
    let targetUserId: string;

    if (body.target_user_id && body.account_id) {
      // Admin mode: refresh another user's account
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (!adminProfile || adminProfile.role !== 'admin') {
        throw new Error('Accès refusé - administrateur uniquement');
      }

      targetStripeAccountId = body.account_id;
      targetUserId = body.target_user_id;
    } else {
      // Self mode: refresh own account
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, stripe_account_id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || !profile) {
        throw new Error('Profil non trouvé');
      }

      if (!profile.stripe_account_id) {
        throw new Error('Aucun compte Stripe Connect trouvé');
      }

      targetStripeAccountId = profile.stripe_account_id;
      targetUserId = profile.id;
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    const account = await stripe.accounts.retrieve(targetStripeAccountId);

    const detailsSubmitted = account.details_submitted || false;
    const chargesEnabled = account.charges_enabled || false;
    const payoutsEnabled = account.payouts_enabled || false;

    let onboardingStatus = 'pending';
    if (payoutsEnabled) {
      onboardingStatus = 'complete';
    } else if (!detailsSubmitted) {
      onboardingStatus = 'pending';
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        stripe_details_submitted: detailsSubmitted,
        stripe_charges_enabled: chargesEnabled,
        stripe_payouts_enabled: payoutsEnabled,
        stripe_onboarding_status: onboardingStatus,
        stripe_onboarding_updated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId);

    if (updateError) {
      console.error('Erreur mise à jour statut:', updateError);
    }

    const requirements = {
      currently_due: account.requirements?.currently_due || [],
      eventually_due: account.requirements?.eventually_due || [],
      past_due: account.requirements?.past_due || [],
      pending_verification: account.requirements?.pending_verification || [],
    };

    return new Response(
      JSON.stringify({
        success: true,
        status: {
          details_submitted: detailsSubmitted,
          charges_enabled: chargesEnabled,
          payouts_enabled: payoutsEnabled,
          onboarding_status: onboardingStatus,
          requirements: requirements,
          account_id: account.id,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Erreur stripe-get-account-status:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erreur lors de la récupération du statut du compte',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
