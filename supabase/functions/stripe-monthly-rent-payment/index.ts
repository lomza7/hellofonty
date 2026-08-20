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
            stripe_account_id,
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

    // Resolve the Stripe account: listing-level first, then landlord profile fallback
    const listingStripeAccountId = payment.booking?.listing?.stripe_account_id;
    const landlordStripeAccountId = payment.booking?.listing?.landlord?.stripe_account_id;
    const landlordChargesEnabled = payment.booking?.listing?.landlord?.stripe_charges_enabled;

    let stripeAccountId: string | null = null;

    if (listingStripeAccountId) {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      const { data: lsaAccount } = await supabaseAdmin
        .from('landlord_stripe_accounts')
        .select('stripe_charges_enabled')
        .eq('stripe_account_id', listingStripeAccountId)
        .eq('landlord_id', payment.booking.listing.landlord_id)
        .maybeSingle();

      if (lsaAccount?.stripe_charges_enabled) {
        stripeAccountId = listingStripeAccountId;
      } else {
        throw new Error('Le compte de versement associé à cet appartement n\'est pas encore activé');
      }
    } else if (landlordStripeAccountId && landlordChargesEnabled) {
      stripeAccountId = landlordStripeAccountId;
    }

    if (!stripeAccountId) {
      throw new Error('Le propriétaire n\'a pas configuré son compte Stripe');
    }

    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      Deno.env.get('APP_URL') || '',
    ].filter(Boolean);
    const origin = req.headers.get('origin');
    if (!origin || !allowedOrigins.includes(origin)) {
      throw new Error('Origine non autorisée');
    }

    const rentAmountRaw = parseFloat(payment.rent_amount);

    const rentAmount = Math.round(rentAmountRaw * 100);

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
      ],
      mode: 'payment',
      success_url: `${origin}/mes-loyers?payment=success`,
      cancel_url: `${origin}/mes-loyers?payment=cancelled`,
      metadata: {
        payment_id: payment_id,
        booking_id: payment.booking_id,
        student_id: user.id,
        landlord_id: payment.booking.listing.landlord_id,
        payment_type: 'monthly_rent',
        month_year: payment.month_year,
      },
      payment_intent_data: {
        on_behalf_of: stripeAccountId,
        metadata: {
          payment_id: payment_id,
          booking_id: payment.booking_id,
          type: 'monthly_rent_payment',
          month_year: payment.month_year,
        },
      },
    });

    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

    if (paymentIntentId) {
      await supabaseClient
        .from('rent_payments')
        .update({
          stripe_payment_intent_id: paymentIntentId,
        })
        .eq('id', payment_id);
    }

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
