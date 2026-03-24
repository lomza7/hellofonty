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

    const { booking_id } = await req.json();

    if (!booking_id) {
      throw new Error('ID de réservation manquant');
    }

    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select(`
        *,
        listing:listings(
          id,
          title,
          address,
          landlord_id,
          landlord:profiles!landlord_id(stripe_account_id, stripe_charges_enabled)
        )
      `)
      .eq('id', booking_id)
      .maybeSingle();

    if (bookingError || !booking) {
      throw new Error('Réservation introuvable');
    }

    if (booking.student_id !== user.id) {
      throw new Error('Non autorisé');
    }

    if (booking.payment_status === 'completed') {
      throw new Error('Cette réservation a déjà été payée');
    }

    if (booking.payment_status === 'expired') {
      throw new Error('Le délai de paiement a expiré');
    }

    const deadline = new Date(booking.payment_deadline);
    if (deadline < new Date()) {
      await supabaseClient
        .from('bookings')
        .update({ payment_status: 'expired' })
        .eq('id', booking_id);

      throw new Error('Le délai de paiement a expiré');
    }

    if (!booking.listing?.landlord?.stripe_account_id || !booking.listing?.landlord?.stripe_charges_enabled) {
      throw new Error('Le propriétaire n\'a pas configuré son compte Stripe');
    }

    const { data: platformSettings } = await supabaseClient
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'platform_fee_amount')
      .maybeSingle();

    const platformFeeAmount = platformSettings?.setting_value ? parseFloat(platformSettings.setting_value) : 390;

    const rentAmount = Math.round(booking.rent_amount * 100);
    const depositAmount = Math.round((booking.deposit_amount || 0) * 100);
    const platformFee = Math.round(platformFeeAmount * 100);

    const landlordAmount = rentAmount + depositAmount;
    const totalAmount = landlordAmount + platformFee;

    const rentDescription = booking.is_first_month_partial
      ? `Premier mois (prorata) : Du ${new Date(booking.start_date).toLocaleDateString('fr-FR')} au ${new Date(new Date(booking.start_date).getFullYear(), new Date(booking.start_date).getMonth() + 1, 0).toLocaleDateString('fr-FR')}`
      : `Premier mois : Du ${new Date(booking.start_date).toLocaleDateString('fr-FR')} au ${new Date(new Date(booking.start_date).getFullYear(), new Date(booking.start_date).getMonth() + 1, 0).toLocaleDateString('fr-FR')}`;

    const lineItems = [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: `${booking.listing.title} - Loyer`,
            description: rentDescription,
            images: [],
          },
          unit_amount: rentAmount,
        },
        quantity: 1,
      },
    ];

    if (depositAmount > 0) {
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Caution',
            description: 'Dépôt de garantie (remboursable en fin de location)',
          },
          unit_amount: depositAmount,
        },
        quantity: 1,
      });
    }

    lineItems.push({
      price_data: {
        currency: 'eur',
        product_data: {
          name: 'Frais de réservation Hellofonty',
          description: 'Frais de réservation étudiant (paiement unique)',
        },
        unit_amount: platformFee,
      },
      quantity: 1,
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${req.headers.get('origin')}/payment-success?booking_id=${booking_id}`,
      cancel_url: `${req.headers.get('origin')}/payment/${booking_id}`,
      metadata: {
        booking_id: booking_id,
        student_id: user.id,
        listing_id: booking.listing_id,
        landlord_id: booking.listing.landlord_id,
        payment_type: 'first_payment',
      },
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: booking.listing.landlord.stripe_account_id,
        },
        metadata: {
          booking_id: booking_id,
          type: 'first_rent_payment',
        },
      },
    });

    await supabaseClient
      .from('bookings')
      .update({
        stripe_payment_intent_id: session.payment_intent as string,
      })
      .eq('id', booking_id);

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Erreur:', error);
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