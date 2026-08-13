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

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || profile.role !== 'landlord') {
      throw new Error('Accès refusé - propriétaire uniquement');
    }

    const { deposit_id, retained_amount, retention_reason } = await req.json();

    if (!deposit_id) {
      throw new Error('ID de caution manquant');
    }

    const { data: deposit, error: depositError } = await supabaseClient
      .from('deposit_transactions')
      .select(`
        id,
        booking_id,
        listing_id,
        landlord_id,
        student_id,
        deposit_amount,
        retained_amount,
        refunded_amount,
        status,
        stripe_payment_intent_id
      `)
      .eq('id', deposit_id)
      .maybeSingle();

    if (depositError || !deposit) {
      throw new Error('Caution introuvable');
    }

    if (deposit.landlord_id !== user.id) {
      throw new Error('Vous n\'êtes pas autorisé à gérer cette caution');
    }

    if (deposit.status !== 'collected') {
      throw new Error('Cette caution a déjà été traitée');
    }

    const retainAmt = Math.max(0, Math.min(retained_amount || 0, deposit.deposit_amount));
    const refundAmt = deposit.deposit_amount - retainAmt;

    if (refundAmt <= 0) {
      throw new Error('Le montant à rembourser doit être supérieur à 0');
    }

    // Mark as refunding
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabaseAdmin
      .from('deposit_transactions')
      .update({ status: 'refunding' })
      .eq('id', deposit_id);

    // Retrieve the original payment intent to get the charge
    if (!deposit.stripe_payment_intent_id) {
      throw new Error('Aucun identifiant de paiement Stripe trouvé pour cette caution');
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(
      deposit.stripe_payment_intent_id
    );

    if (!paymentIntent.latest_charge) {
      throw new Error('Aucune charge trouvée pour ce paiement');
    }

    const chargeId = typeof paymentIntent.latest_charge === 'string'
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge.id;

    const refund = await stripe.refunds.create({
      charge: chargeId,
      amount: Math.round(refundAmt * 100),
      metadata: {
        deposit_id: deposit_id,
        booking_id: deposit.booking_id,
        landlord_id: user.id,
        retained_amount: retainAmt.toString(),
        type: 'deposit_refund',
      },
    });

    const newStatus = retainAmt > 0 ? 'retained' : 'refunded';

    await supabaseAdmin
      .from('deposit_transactions')
      .update({
        status: newStatus,
        retained_amount: retainAmt,
        refunded_amount: refundAmt,
        retention_reason: retention_reason || null,
        stripe_refund_id: refund.id,
        refunded_at: new Date().toISOString(),
      })
      .eq('id', deposit_id);

    // Notify the student
    await supabaseAdmin.from('notifications').insert({
      user_id: deposit.student_id,
      type: 'deposit_refund',
      message: retainAmt > 0
        ? `Votre caution de ${deposit.deposit_amount}€ a été remboursée. Retenue: ${retainAmt}€${retention_reason ? ` (${retention_reason})` : ''}. Montant remboursé: ${refundAmt}€.`
        : `Votre caution de ${deposit.deposit_amount}€ a été entièrement remboursée.`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        refund_id: refund.id,
        refunded_amount: refundAmt,
        retained_amount: retainAmt,
        status: newStatus,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Erreur stripe-deposit-refund:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
