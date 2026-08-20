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
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
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

    if (!profile || profile.role !== 'admin') {
      throw new Error('Accès refusé - administrateur uniquement');
    }

    const { booking_id, refund_type, amount } = await req.json();

    if (!booking_id) {
      throw new Error('ID de réservation manquant');
    }

    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select(`
        id,
        payment_status,
        payment_amount,
        rent_amount,
        deposit_amount,
        platform_fee,
        stripe_payment_intent_id,
        student_id,
        listing:listings(
          id,
          title,
          landlord_id,
          landlord:profiles!landlord_id(stripe_account_id)
        )
      `)
      .eq('id', booking_id)
      .maybeSingle();

    if (bookingError || !booking) {
      throw new Error('Réservation introuvable');
    }

    if (booking.payment_status !== 'completed') {
      throw new Error('Cette réservation n\'a pas été payée');
    }

    if (!booking.stripe_payment_intent_id) {
      throw new Error('Aucun identifiant de paiement Stripe trouvé');
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(
      booking.stripe_payment_intent_id
    );

    if (!paymentIntent.latest_charge) {
      throw new Error('Aucune charge trouvée pour ce paiement');
    }

    const chargeId = typeof paymentIntent.latest_charge === 'string'
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge.id;

    let refundAmount: number;
    let refundDescription: string;
    let isPlatformFeeRefund = false;

    if (refund_type === 'platform_fee') {
      const fee = booking.platform_fee || 0;
      if (fee <= 0) {
        throw new Error('Aucun frais de plateforme enregistré pour cette réservation');
      }
      refundAmount = Math.round(fee * 100);
      refundDescription = 'Remboursement des frais de plateforme Hellofonty';
      isPlatformFeeRefund = true;
    } else if (refund_type === 'full') {
      refundAmount = Math.round(Number(booking.payment_amount) * 100);
      refundDescription = 'Remboursement total de la réservation';
    } else if (refund_type === 'partial') {
      if (!amount || amount <= 0) {
        throw new Error('Montant du remboursement partiel manquant');
      }
      refundAmount = Math.round(amount * 100);
      refundDescription = 'Remboursement partiel';
    } else {
      throw new Error('Type de remboursement invalide');
    }

    let refundId: string;
    let refundStatus: string;

    if (isPlatformFeeRefund) {
      // For platform fee refunds, we need to refund the application fee, not the charge.
      // Refunding the charge would reduce the landlord's payout, not the platform's fee.
      const charge = await stripe.charges.retrieve(chargeId);
      const applicationFeeId = charge.application_fee?.id;
      if (!applicationFeeId) {
        throw new Error('Aucune application fee trouvée sur cette charge');
      }
      const feeRefund = await stripe.applicationFees.refund(
        applicationFeeId,
        {
          amount: refundAmount,
          metadata: {
            booking_id: booking_id,
            refund_type: refund_type,
            admin_id: user.id,
            description: refundDescription,
          },
        },
        {
          idempotencyKey: `booking_${booking_id}_platform_fee_refund`,
        }
      );
      refundId = feeRefund.id;
      refundStatus = feeRefund.status;
    } else {
      const refund = await stripe.refunds.create(
        {
          charge: chargeId,
          amount: refundAmount,
          metadata: {
            booking_id: booking_id,
            refund_type: refund_type,
            admin_id: user.id,
            description: refundDescription,
          },
        },
        {
          idempotencyKey: `booking_${booking_id}_${refund_type}_refund`,
        }
      );
      refundId = refund.id;
      refundStatus = refund.status;
    }

    const refundRecord = {
      booking_id: booking_id,
      student_id: booking.student_id,
      amount: refundAmount / 100,
      refund_type: refund_type,
      stripe_refund_id: refundId,
      admin_id: user.id,
      created_at: new Date().toISOString(),
    };

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabaseAdmin.from('refunds').insert(refundRecord);

    if (refund_type === 'full') {
      await supabaseAdmin
        .from('bookings')
        .update({ payment_status: 'refunded' })
        .eq('id', booking_id);
    } else if (refund_type === 'platform_fee') {
      await supabaseAdmin
        .from('bookings')
        .update({ platform_fee_refunded: true })
        .eq('id', booking_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        refund_id: refundId,
        amount: refundAmount / 100,
        status: refundStatus,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Erreur stripe-refund:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
