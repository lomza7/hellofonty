import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import Stripe from 'npm:stripe@14.11.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
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
      .select('id, role, first_name, last_name')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      throw new Error('Profil non trouvé');
    }

    if (profile.role !== 'landlord') {
      throw new Error('Seuls les propriétaires peuvent gérer des comptes Stripe Connect');
    }

    const body = await req.json();
    const action = body.action || 'create';

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    if (action === 'create') {
      // Create a new Stripe Express account for this landlord
      const label = body.label || 'Compte secondaire';

      const account = await stripe.accounts.create({
        type: 'express',
        country: 'FR',
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: {
          supabase_user_id: user.id,
          landlord_name: `${profile.first_name} ${profile.last_name}`,
          label: label,
        },
      });

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

      // If this is the landlord's first account, mark it as default
      // and also set it on the profile for backward compatibility
      const { data: existingAccounts } = await supabaseAdmin
        .from('landlord_stripe_accounts')
        .select('id')
        .eq('landlord_id', user.id)
        .limit(1);

      const isFirstAccount = !existingAccounts || existingAccounts.length === 0;

      const { data: newAccount, error: insertError } = await supabaseAdmin
        .from('landlord_stripe_accounts')
        .insert({
          landlord_id: user.id,
          stripe_account_id: account.id,
          label: label,
          is_default: isFirstAccount,
          stripe_onboarding_status: 'pending',
          stripe_onboarding_updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('Erreur insertion landlord_stripe_accounts:', insertError);
        throw new Error('Erreur lors de la sauvegarde du compte Stripe');
      }

      // For backward compatibility, set profile.stripe_account_id if this is the first account
      if (isFirstAccount) {
        await supabaseAdmin
          .from('profiles')
          .update({
            stripe_account_id: account.id,
            stripe_onboarding_status: 'pending',
            stripe_onboarding_updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          account: newAccount,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'list') {
      // Return all Stripe accounts for this landlord
      const { data: accounts, error: listError } = await supabase
        .from('landlord_stripe_accounts')
        .select('*')
        .eq('landlord_id', user.id)
        .order('created_at', { ascending: true });

      if (listError) {
        throw new Error('Erreur lors de la récupération des comptes');
      }

      return new Response(
        JSON.stringify({
          success: true,
          accounts: accounts || [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'set_default') {
      // Set a specific account as the default
      const accountId = body.accountId;
      if (!accountId) throw new Error('accountId manquant');

      // Verify ownership
      const { data: account, error: accountError } = await supabase
        .from('landlord_stripe_accounts')
        .select('id, stripe_account_id')
        .eq('id', accountId)
        .eq('landlord_id', user.id)
        .maybeSingle();

      if (accountError || !account) {
        throw new Error('Compte introuvable ou non autorisé');
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

      // Unset all defaults for this landlord
      await supabaseAdmin
        .from('landlord_stripe_accounts')
        .update({ is_default: false, updated_at: new Date().toISOString() })
        .eq('landlord_id', user.id);

      // Set the new default
      await supabaseAdmin
        .from('landlord_stripe_accounts')
        .update({ is_default: true, updated_at: new Date().toISOString() })
        .eq('id', accountId);

      // Update profile for backward compatibility
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_account_id: account.stripe_account_id })
        .eq('id', user.id);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'sync_status') {
      // Sync the status of all accounts from Stripe
      const { data: accounts, error: listError } = await supabase
        .from('landlord_stripe_accounts')
        .select('*')
        .eq('landlord_id', user.id);

      if (listError) {
        throw new Error('Erreur lors de la récupération des comptes');
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const updatedAccounts: any[] = [];

      for (const acc of accounts || []) {
        try {
          const stripeAccount = await stripe.accounts.retrieve(acc.stripe_account_id);

          const detailsSubmitted = stripeAccount.details_submitted || false;
          const chargesEnabled = stripeAccount.charges_enabled || false;
          const payoutsEnabled = stripeAccount.payouts_enabled || false;

          let onboardingStatus = 'pending';
          if (payoutsEnabled) {
            onboardingStatus = 'complete';
          } else if (!detailsSubmitted) {
            onboardingStatus = 'pending';
          }

          await supabaseAdmin
            .from('landlord_stripe_accounts')
            .update({
              stripe_details_submitted: detailsSubmitted,
              stripe_charges_enabled: chargesEnabled,
              stripe_payouts_enabled: payoutsEnabled,
              stripe_onboarding_status: onboardingStatus,
              stripe_onboarding_updated_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', acc.id);

          updatedAccounts.push({
            ...acc,
            stripe_details_submitted: detailsSubmitted,
            stripe_charges_enabled: chargesEnabled,
            stripe_payouts_enabled: payoutsEnabled,
            stripe_onboarding_status: onboardingStatus,
          });

          // If this is the default account, also update the profile
          if (acc.is_default) {
            await supabaseAdmin
              .from('profiles')
              .update({
                stripe_details_submitted: detailsSubmitted,
                stripe_charges_enabled: chargesEnabled,
                stripe_payouts_enabled: payoutsEnabled,
                stripe_onboarding_status: onboardingStatus,
                stripe_onboarding_updated_at: new Date().toISOString(),
              })
              .eq('id', user.id);
          }
        } catch (e) {
          console.error(`Erreur sync compte ${acc.stripe_account_id}:`, e);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          accounts: updatedAccounts,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete') {
      // Delete a Stripe account record (does not delete the Stripe account itself)
      const accountId = body.accountId;
      if (!accountId) throw new Error('accountId manquant');

      // Verify ownership
      const { data: account } = await supabase
        .from('landlord_stripe_accounts')
        .select('id, is_default, stripe_account_id')
        .eq('id', accountId)
        .eq('landlord_id', user.id)
        .maybeSingle();

      if (!account) {
        throw new Error('Compte introuvable ou non autorisé');
      }

      if (account.is_default) {
        throw new Error('Vous ne pouvez pas supprimer le compte par défaut');
      }

      // Check no listings are using this account
      const { data: linkedListings } = await supabase
        .from('listings')
        .select('id')
        .eq('landlord_id', user.id)
        .eq('stripe_account_id', account.stripe_account_id)
        .limit(1);

      if (linkedListings && linkedListings.length > 0) {
        throw new Error('Des appartements sont encore associés à ce compte. Réassociez-les avant de le supprimer.');
      }

      await supabase
        .from('landlord_stripe_accounts')
        .delete()
        .eq('id', accountId);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Action non reconnue');
  } catch (error) {
    console.error('Erreur stripe-manage-landlord-account:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erreur lors de la gestion du compte Stripe',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
