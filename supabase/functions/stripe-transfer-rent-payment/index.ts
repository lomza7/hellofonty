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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!adminProfile || adminProfile.role !== 'admin') {
      throw new Error('Accès refusé : administrateur uniquement');
    }

    const body = await req.json();
    const { rent_payment_id, destination_account_id } = body;

    if (!rent_payment_id) {
      throw new Error('ID du paiement de loyer manquant');
    }
    if (!destination_account_id) {
      throw new Error('ID du compte Stripe de destination manquant');
    }

    // Fetch the rent payment with all needed relations
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('rent_payments')
      .select(`
        id,
        booking_id,
        student_id,
        rent_amount,
        platform_fee,
        total_amount,
        status,
        month_year,
        paid_at,
        stripe_payment_intent_id,
        stripe_charge_id,
        stripe_session_id,
        stripe_payout_id,
        booking:bookings(
          id,
          listing_id,
          listing:listings(
            id,
            title,
            landlord_id,
            stripe_account_id
          )
        )
      `)
      .eq('id', rent_payment_id)
      .maybeSingle();

    if (paymentError || !payment) {
      throw new Error('Paiement introuvable');
    }

    if (payment.status !== 'paid') {
      throw new Error('Ce paiement n\'est pas marqué comme payé');
    }

    // Idempotency: skip if already transferred
    if (payment.stripe_payout_id) {
      return new Response(
        JSON.stringify({
          success: true,
          already_transferred: true,
          transfer_id: payment.stripe_payout_id,
          message: 'Ce paiement a déjà été transféré.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the destination account is valid and belongs to the landlord
    const landlordId = payment.booking?.listing?.landlord_id;
    if (!landlordId) {
      throw new Error('Propriétaire introuvable');
    }

    const { data: lsaAccount } = await supabaseAdmin
      .from('landlord_stripe_accounts')
      .select('stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled')
      .eq('landlord_id', landlordId)
      .eq('stripe_account_id', destination_account_id)
      .maybeSingle();

    if (!lsaAccount) {
      throw new Error('Le compte Stripe de destination n\'appartient pas à ce propriétaire');
    }

    if (!lsaAccount.stripe_charges_enabled || !lsaAccount.stripe_payouts_enabled) {
      throw new Error('Le compte Stripe de destination n\'est pas pleinement activé');
    }

    const rentAmountCents = Math.round(parseFloat(payment.rent_amount) * 100);

    // Find the charge on the platform account to transfer from
    let sourceChargeId = payment.stripe_charge_id;

    // If we don't have a charge ID, try to find it via the payment intent
    if (!sourceChargeId && payment.stripe_payment_intent_id) {
      try {
        const pi = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id, {
          expand: ['latest_charge'],
        });
        const charge = pi.latest_charge;
        if (charge) {
          sourceChargeId = typeof charge === 'string' ? charge : charge.id;
        }
      } catch (err) {
        console.error('Error retrieving charge from payment intent:', err);
      }
    }

    // If still no charge ID, search recent charges for matching metadata
    if (!sourceChargeId) {
      const charges = await stripe.charges.list({
        limit: 100,
      });
      const matchingCharge = charges.data.find((c) => {
        return c.metadata?.payment_id === payment.id ||
          c.metadata?.type === 'monthly_rent_payment';
      });
      if (matchingCharge) {
        sourceChargeId = matchingCharge.id;
      }
    }

    if (!sourceChargeId) {
      throw new Error(
        'Impossible de trouver la charge Stripe associée à ce paiement. ' +
        'Vérifiez que le paiement a bien été encaissé sur le compte Stripe de la plateforme.'
      );
    }

    // Create a transfer to the landlord's connected account
    const transfer = await stripe.transfers.create({
      amount: rentAmountCents,
      currency: 'eur',
      destination: destination_account_id,
      source_transaction: sourceChargeId,
      description: `Transfert loyer ${payment.month_year} — ${payment.booking?.listing?.title || 'Logement'}`,
      metadata: {
        rent_payment_id: payment.id,
        booking_id: payment.booking_id,
        landlord_id: landlordId,
        month_year: payment.month_year,
        transfer_type: 'monthly_rent_transfer',
        transferred_by_admin: user.id,
      },
    }, {
      idempotencyKey: `rent_transfer_${payment.id}`,
    });

    // Record the transfer in the database
    await supabaseAdmin
      .from('rent_payments')
      .update({
        stripe_payout_id: transfer.id,
        stripe_payout_date: new Date().toISOString(),
        stripe_charge_id: sourceChargeId,
      })
      .eq('id', payment.id);

    // Also fix the listing's stripe_account_id if it was wrong
    const listingStripeAccount = payment.booking?.listing?.stripe_account_id;
    if (listingStripeAccount && listingStripeAccount !== destination_account_id) {
      await supabaseAdmin
        .from('listings')
        .update({ stripe_account_id: destination_account_id })
        .eq('id', payment.booking.listing.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        transfer_id: transfer.id,
        amount: rentAmountCents,
        destination_account: destination_account_id,
        source_charge: sourceChargeId,
        message: `Transfert de ${(rentAmountCents / 100).toFixed(2)} € effectué vers le compte Stripe du propriétaire.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Erreur transfert:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
