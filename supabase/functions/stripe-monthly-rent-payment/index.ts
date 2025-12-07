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

    const { payment_id } = await req.json();

    if (!payment_id) {
      throw new Error('ID de paiement manquant');
    }

    const { data: payment, error: paymentError } = await supabaseClient
      .from('rent_payments')
      .select(`
        *,
        booking:bookings(
          id,
          start_date,
          end_date,
          listing:listings(
            id,
            title,
            address,
            landlord_id,
            landlord:profiles!landlord_id(stripe_account_id, stripe_charges_enabled)
          )
        )
      `)
      .eq('id', payment_id)
      .maybeSingle();

    if (paymentError || !payment) {
      throw new Error('Paiement introuvable');
    }

    if (payment.student_id !== user.id) {
      throw new Error('Non autorisé');
    }

    if (payment.status === 'paid') {
      throw new Error('Ce paiement a déjà été effectué');
    }

    if (payment.status === 'cancelled') {
      throw new Error('Ce paiement a été annulé');
    }

    if (!payment.booking?.listing?.landlord?.stripe_account_id ||
        !payment.booking?.listing?.landlord?.stripe_charges_enabled) {
      throw new Error('Le propriétaire n\'a pas configuré son compte Stripe');
    }

    const rentAmount = Math.round(payment.rent_amount * 100);
    const platformFee = Math.round(payment.platform_fee * 100);
    const totalAmount = Math.round(payment.total_amount * 100);

    const landlordAmount = rentAmount;

    const monthDate = new Date(payment.payment_date);
    const monthName = monthDate.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${payment.booking.listing.title} - Loyer mensuel`,
              description: `Loyer pour ${monthName}`,
              images: [],
            },
            unit_amount: rentAmount,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Frais de plateforme Hellofonty',
              description: 'Frais de traitement mensuel',
            },
            unit_amount: platformFee,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.get('origin')}/mes-loyers?payment=success`,
      cancel_url: `${req.headers.get('origin')}/mes-loyers?payment=cancelled`,
      metadata: {
        payment_id: payment_id,
        booking_id: payment.booking_id,
        student_id: user.id,
        landlord_id: payment.booking.listing.landlord_id,
        payment_type: 'monthly_rent',
        month_year: payment.month_year,
      },
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: payment.booking.listing.landlord.stripe_account_id,
        },
        metadata: {
          payment_id: payment_id,
          booking_id: payment.booking_id,
          type: 'monthly_rent_payment',
          month_year: payment.month_year,
        },
      },
    });

    await supabaseClient
      .from('rent_payments')
      .update({
        stripe_payment_intent_id: session.payment_intent as string,
      })
      .eq('id', payment_id);

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