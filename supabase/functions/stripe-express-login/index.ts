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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, stripe_account_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      throw new Error('Profil non trouvé');
    }

    if (profile.role !== 'landlord') {
      throw new Error('Accès réservé aux propriétaires');
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch (_e) {
      // body is optional for backward compatibility
    }

    let stripeAccountId: string | null = null;

    if (body.accountId) {
      // Look up the account in landlord_stripe_accounts and verify ownership
      const { data: lsaAccount, error: lsaError } = await supabase
        .from('landlord_stripe_accounts')
        .select('stripe_account_id')
        .eq('id', body.accountId)
        .eq('landlord_id', user.id)
        .maybeSingle();

      if (lsaError || !lsaAccount) {
        throw new Error('Ce compte Stripe ne vous appartient pas');
      }

      stripeAccountId = lsaAccount.stripe_account_id;
    } else {
      // Fall back to profile-level stripe_account_id
      stripeAccountId = profile.stripe_account_id;
    }

    if (!stripeAccountId) {
      throw new Error('Aucun compte Stripe Connect configuré');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    const loginLink = await stripe.accounts.createLoginLink(stripeAccountId);

    return new Response(
      JSON.stringify({
        success: true,
        url: loginLink.url,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Erreur stripe-express-login:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erreur lors de la génération du lien',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
