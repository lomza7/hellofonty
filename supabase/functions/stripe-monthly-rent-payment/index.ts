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

    const body = await req.json();
    const { payment_id, booking_id, month_year } = body;

    if (!payment_id && !booking_id) {
      throw new Error('ID de paiement ou de réservation manquant');
    }

    let payment: any = null;

    if (payment_id) {
      const { data, error: paymentError } = await supabaseClient
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

      if (paymentError || !data) {
        throw new Error('Paiement introuvable');
      }
      payment = data;
    } else {
      // Look up by booking_id + month_year, create if missing
      const { data: booking, error: bookingError } = await supabaseClient
        .from('bookings')
        .select(`
          id,
          student_id,
          start_date,
          end_date,
          listing:listings(
            id,
            title,
            address,
            landlord_id,
            price_per_month,
            stripe_account_id,
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

      const { data: existing } = await supabaseClient
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
        .eq('booking_id', booking_id)
        .eq('month_year', month_year)
        .maybeSingle();

      if (existing) {
        payment = existing;
      } else {
        // Create the missing rent payment entry
        const paymentDate = new Date(month_year.split('-')[0], parseInt(month_year.split('-')[1]) - 1, 5);
        const { data: newPayment, error: insertError } = await supabaseClient
          .from('rent_payments')
          .insert({
            booking_id: booking_id,
            student_id: user.id,
            rent_amount: booking.listing?.price_per_month || 0,
            platform_fee: 0,
            total_amount: booking.listing?.price_per_month || 0,
            payment_date: paymentDate.toISOString().split('T')[0],
            month_year: month_year,
            status: 'pending',
          })
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
          .maybeSingle();

        if (insertError || !newPayment) {
          throw new Error('Impossible de créer le paiement');
        }
        payment = newPayment;
      }
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

    const origin = req.headers.get('origin');
    if (!origin) {
      throw new Error('Origine manquante');
    }
    const isLocalhost = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
    const isHttps = origin.startsWith('https://');
    if (!isLocalhost && !isHttps) {
      throw new Error('Origine non autorisée');
    }

    if (!payment.booking?.listing?.landlord_id) {
      throw new Error('Logement introuvable ou propriétaire manquant');
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
        payment_id: payment.id,
        booking_id: payment.booking_id,
        student_id: user.id,
        landlord_id: payment.booking.listing.landlord_id,
        payment_type: 'monthly_rent',
        month_year: payment.month_year,
      },
      payment_intent_data: {
        on_behalf_of: stripeAccountId,
        metadata: {
          payment_id: payment.id,
          booking_id: payment.booking_id,
          type: 'monthly_rent_payment',
          month_year: payment.month_year,
        },
      },
    }, {
      idempotencyKey: `rent_payment_${payment.id}_checkout`,
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
        .eq('id', payment.id);
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
