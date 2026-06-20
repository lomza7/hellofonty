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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY non configurée');
    }

    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Non authentifié');
    }

    const { accountId, origin } = await req.json();

    if (!origin) {
      throw new Error('Origin manquant');
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, stripe_account_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      throw new Error('Profil non trouvé');
    }

    const stripeAccountId = accountId || profile.stripe_account_id;

    if (!stripeAccountId) {
      throw new Error('Aucun compte Stripe Connect trouvé. Veuillez d\'abord créer un compte.');
    }

    if (profile.stripe_account_id && profile.stripe_account_id !== stripeAccountId) {
      throw new Error('Ce compte Stripe ne vous appartient pas');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${origin}/versements/refresh`,
      return_url: `${origin}/versements/felicitations`,
      type: 'account_onboarding',
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        url: accountLink.url 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erreur stripe-create-onboarding-link:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erreur lors de la création du lien d\'onboarding' 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});