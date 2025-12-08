import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  try {
    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // get the signature from the header
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('No signature found', { status: 400 });
    }

    // get the raw body
    const body = await req.text();

    // verify the webhook signature
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
    } catch (error: any) {
      console.error(`Webhook signature verification failed: ${error.message}`);
      return new Response(`Webhook signature verification failed: ${error.message}`, { status: 400 });
    }

    EdgeRuntime.waitUntil(handleEvent(event));

    return Response.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  const stripeData = event?.data?.object ?? {};

  if (!stripeData) {
    return;
  }

  // Handle invoice payment succeeded
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = stripeData as Stripe.Invoice;

    console.info(`Processing invoice payment: ${invoice.id}`);

    try {
      // Get the user_id from stripe_customers table (more reliable for race conditions)
      const { data: customerData, error: customerError } = await supabase
        .from('stripe_customers')
        .select('user_id')
        .eq('customer_id', invoice.customer)
        .maybeSingle();

      if (customerError || !customerData) {
        console.error('Error fetching user_id for invoice:', customerError);
        return;
      }

      // Check if invoice already exists
      const { data: existingInvoice } = await supabase
        .from('invoices')
        .select('id')
        .eq('stripe_invoice_id', invoice.id)
        .maybeSingle();

      if (existingInvoice) {
        console.info(`Invoice ${invoice.id} already exists, skipping`);
        return;
      }

      // Insert the invoice
      const { error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          user_id: customerData.user_id,
          stripe_invoice_id: invoice.id,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          status: invoice.status === 'paid' ? 'paid' : invoice.status,
          invoice_pdf: invoice.invoice_pdf,
          hosted_invoice_url: invoice.hosted_invoice_url,
          billing_reason: invoice.billing_reason,
        });

      if (invoiceError) {
        console.error('Error inserting invoice:', invoiceError);
      } else {
        console.info(`Successfully inserted invoice: ${invoice.id}`);
      }
    } catch (error) {
      console.error('Error processing invoice payment:', error);
    }

    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = stripeData as Stripe.Checkout.Session;

    if (session.metadata?.payment_type === 'first_payment' && session.metadata?.booking_id) {
      console.info(`Processing first rent payment for booking: ${session.metadata.booking_id}`);

      try {
        const { error } = await supabase
          .from('bookings')
          .update({
            payment_status: 'completed',
          })
          .eq('id', session.metadata.booking_id);

        if (error) {
          console.error('Error updating booking payment status:', error);
        } else {
          console.info(`Successfully updated payment status for booking: ${session.metadata.booking_id}`);
        }
      } catch (error) {
        console.error('Error processing first rent payment:', error);
      }

      return;
    }

    if (session.metadata?.payment_type === 'monthly_rent' && session.metadata?.payment_id) {
      console.info(`Processing monthly rent payment: ${session.metadata.payment_id}`);

      try {
        const { error } = await supabase
          .from('rent_payments')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
          })
          .eq('id', session.metadata.payment_id);

        if (error) {
          console.error('Error updating rent payment status:', error);
        } else {
          console.info(`Successfully updated rent payment: ${session.metadata.payment_id}`);
        }
      } catch (error) {
        console.error('Error processing monthly rent payment:', error);
      }

      return;
    }

    if (session.metadata?.booking_id) {
      console.info(`Processing booking payment for booking: ${session.metadata.booking_id}`);

      try {
        const { error } = await supabase
          .from('bookings')
          .update({
            payment_status: 'completed',
          })
          .eq('id', session.metadata.booking_id);

        if (error) {
          console.error('Error updating booking payment status:', error);
        } else {
          console.info(`Successfully updated payment status for booking: ${session.metadata.booking_id}`);
        }
      } catch (error) {
        console.error('Error processing booking payment:', error);
      }

      return;
    }
  }

  if (!('customer' in stripeData)) {
    return;
  }

  // for one time payments, we only listen for the checkout.session.completed event
  if (event.type === 'payment_intent.succeeded' && event.data.object.invoice === null) {
    return;
  }

  const { customer: customerId } = stripeData;

  if (!customerId || typeof customerId !== 'string') {
    console.error(`No customer received on event: ${JSON.stringify(event)}`);
  } else {
    let isSubscription = true;

    if (event.type === 'checkout.session.completed') {
      const { mode } = stripeData as Stripe.Checkout.Session;

      isSubscription = mode === 'subscription';

      console.info(`Processing ${isSubscription ? 'subscription' : 'one-time payment'} checkout session`);
    }

    const { mode, payment_status } = stripeData as Stripe.Checkout.Session;

    if (isSubscription) {
      console.info(`Starting subscription sync for customer: ${customerId}`);
      await syncCustomerFromStripe(customerId);
    } else if (mode === 'payment' && payment_status === 'paid') {
      try {
        // Extract the necessary information from the session
        const {
          id: checkout_session_id,
          payment_intent,
          amount_subtotal,
          amount_total,
          currency,
        } = stripeData as Stripe.Checkout.Session;

        // Insert the order into the stripe_orders table
        const { error: orderError } = await supabase.from('stripe_orders').insert({
          checkout_session_id,
          payment_intent_id: payment_intent,
          customer_id: customerId,
          amount_subtotal,
          amount_total,
          currency,
          payment_status,
          status: 'completed', // assuming we want to mark it as completed since payment is successful
        });

        if (orderError) {
          console.error('Error inserting order:', orderError);
          return;
        }
        console.info(`Successfully processed one-time payment for session: ${checkout_session_id}`);
      } catch (error) {
        console.error('Error processing one-time payment:', error);
      }
    }
  }
}

// based on the excellent https://github.com/t3dotgg/stripe-recommendations
async function syncCustomerFromStripe(customerId: string) {
  try {
    // fetch latest subscription data from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
      expand: ['data.default_payment_method'],
    });

    // Get the user_id for this customer
    const { data: customerData, error: customerError } = await supabase
      .from('stripe_customers')
      .select('user_id')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (customerError || !customerData) {
      console.error('Error fetching customer user_id:', customerError);
      throw new Error('Failed to fetch customer user_id');
    }

    const userId = customerData.user_id;

    // TODO verify if needed
    if (subscriptions.data.length === 0) {
      console.info(`No active subscriptions found for customer: ${customerId}`);
      const { error: noSubError } = await supabase.from('stripe_subscriptions').upsert(
        {
          customer_id: customerId,
          subscription_status: 'not_started',
        },
        {
          onConflict: 'customer_id',
        },
      );

      if (noSubError) {
        console.error('Error updating subscription status:', noSubError);
        throw new Error('Failed to update subscription status in database');
      }

      // Also update the user's subscription table to free
      const { error: userSubError } = await supabase
        .from('subscriptions')
        .upsert(
          {
            user_id: userId,
            plan_type: 'free',
            status: 'active',
            stripe_customer_id: customerId,
            stripe_subscription_id: null,
            stripe_price_id: null,
            current_period_start: null,
            current_period_end: null,
            cancel_at_period_end: false,
          },
          {
            onConflict: 'user_id',
          },
        );

      if (userSubError) {
        console.error('Error updating user subscription:', userSubError);
      }

      return;
    }

    // assumes that a customer can only have a single subscription
    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0].price.id;

    // Determine the plan type based on price_id
    const { data: pricingPlan } = await supabase
      .from('pricing_plans')
      .select('price')
      .eq('stripe_price_id', priceId)
      .eq('is_active', true)
      .maybeSingle();

    let planType: 'free' | 'premium' = 'free';
    if (pricingPlan && pricingPlan.price >= 29) {
      planType = 'premium';
    }

    // Map Stripe status to app status
    const subscriptionStatus = subscription.status;
    let appStatus: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing' = 'active';

    if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
      appStatus = subscriptionStatus;
    } else if (subscriptionStatus === 'canceled' || subscriptionStatus === 'incomplete_expired' || subscriptionStatus === 'unpaid') {
      appStatus = 'canceled';
      planType = 'free';
    } else if (subscriptionStatus === 'past_due') {
      appStatus = 'past_due';
    } else if (subscriptionStatus === 'incomplete') {
      appStatus = 'incomplete';
    }

    // store subscription state
    const { error: subError } = await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: customerId,
        subscription_id: subscription.id,
        price_id: priceId,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        ...(subscription.default_payment_method && typeof subscription.default_payment_method !== 'string'
          ? {
              payment_method_brand: subscription.default_payment_method.card?.brand ?? null,
              payment_method_last4: subscription.default_payment_method.card?.last4 ?? null,
            }
          : {}),
        status: subscription.status,
      },
      {
        onConflict: 'customer_id',
      },
    );

    if (subError) {
      console.error('Error syncing subscription:', subError);
      throw new Error('Failed to sync subscription in database');
    }

    // Convert Unix timestamps to ISO strings
    const periodStart = new Date(subscription.current_period_start * 1000).toISOString();
    const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

    // Also sync to the subscriptions table (used by the app)
    const { error: userSubError } = await supabase
      .from('subscriptions')
      .upsert(
        {
          user_id: userId,
          plan_type: planType,
          status: appStatus,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          stripe_price_id: priceId,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          cancel_at_period_end: subscription.cancel_at_period_end,
        },
        {
          onConflict: 'user_id',
        },
      );

    if (userSubError) {
      console.error('Error syncing user subscription:', userSubError);
      throw new Error('Failed to sync user subscription in database');
    }

    console.info(`Successfully synced subscription for customer: ${customerId} and user: ${userId}`);
  } catch (error) {
    console.error(`Failed to sync subscription for customer ${customerId}:`, error);
    throw error;
  }
}
