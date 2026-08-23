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
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
        },
      });
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

    try {
      await handleEvent(event);
    } catch (error) {
      console.error('Error in handleEvent:', error);
      return Response.json({ error: 'Webhook handler failed' }, { status: 500 });
    }

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

  // Handle Stripe Connect account updates (onboarding completion)
  if (event.type === 'account.updated') {
    const account = stripeData as Stripe.Account;
    console.info(`Processing account.updated for: ${account.id}`);

    try {
      const detailsSubmitted = account.details_submitted || false;
      const chargesEnabled = account.charges_enabled || false;
      const payoutsEnabled = account.payouts_enabled || false;

      let onboardingStatus = 'pending';
      if (payoutsEnabled) {
        onboardingStatus = 'complete';
      } else if (!detailsSubmitted) {
        onboardingStatus = 'not_connected';
      }

      const nowIso = new Date().toISOString();

      // 1) Update landlord_stripe_accounts (handles secondary/multi accounts)
      const { data: lsaRows, error: lsaError } = await supabase
        .from('landlord_stripe_accounts')
        .select('id, landlord_id, is_default')
        .eq('stripe_account_id', account.id);

      if (lsaError) {
        console.error('Error querying landlord_stripe_accounts:', lsaError);
      }

      let defaultLandlordId: string | null = null;

      if (lsaRows && lsaRows.length > 0) {
        for (const row of lsaRows) {
          const { error: lsaUpdateError } = await supabase
            .from('landlord_stripe_accounts')
            .update({
              stripe_details_submitted: detailsSubmitted,
              stripe_charges_enabled: chargesEnabled,
              stripe_payouts_enabled: payoutsEnabled,
              stripe_onboarding_status: onboardingStatus,
              stripe_onboarding_updated_at: nowIso,
              updated_at: nowIso,
            })
            .eq('id', row.id);

          if (lsaUpdateError) {
            console.error(`Error updating landlord_stripe_accounts ${row.id}:`, lsaUpdateError);
          } else {
            console.info(`Updated landlord_stripe_accounts ${row.id} -> ${onboardingStatus}`);
          }

          if (row.is_default) {
            defaultLandlordId = row.landlord_id;
          }
        }
      }

      // 2) Update profiles for backward compatibility (default account or legacy single account)
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_account_id', account.id)
        .maybeSingle();

      const profileId = defaultLandlordId || profile?.id;

      if (profileId) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            stripe_details_submitted: detailsSubmitted,
            stripe_charges_enabled: chargesEnabled,
            stripe_payouts_enabled: payoutsEnabled,
            stripe_onboarding_status: onboardingStatus,
            stripe_onboarding_updated_at: nowIso,
          })
          .eq('id', profileId);

        if (updateError) {
          console.error('Error updating Stripe Connect status on profile:', updateError);
        } else {
          console.info(`Updated profile ${profileId} -> ${onboardingStatus}`);
        }
      } else if (!lsaRows || lsaRows.length === 0) {
        console.error('No profile or landlord_stripe_accounts found for Stripe account:', account.id);
      }
    } catch (error) {
      console.error('Error processing account.updated:', error);
    }

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

    if (session.payment_status === 'unpaid' || session.payment_status === 'canceled') {
      console.info(`Checkout session ${session.id} has payment_status ${session.payment_status}, skipping booking update`);
      return;
    }

    if (session.metadata?.payment_type === 'first_payment' && session.metadata?.booking_id) {
      console.info(`Processing first rent payment for booking: ${session.metadata.booking_id}`);

      try {
        const paymentIntentId = typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id ?? null;

        const { data: booking, error: bookingQueryError } = await supabase
          .from('bookings')
          .select('id, listing_id, student_id, deposit_amount, stripe_payment_intent_id, payment_status')
          .eq('id', session.metadata.booking_id)
          .maybeSingle();

        if (bookingQueryError || !booking) {
          console.error('Booking not found:', session.metadata.booking_id);
          return;
        }

        if (booking.payment_status === 'completed') {
          console.info(`Booking ${session.metadata.booking_id} already completed, skipping`);
          return;
        }

        const { error: bookingUpdateError } = await supabase
          .from('bookings')
          .update({
            payment_status: 'completed',
            ...(paymentIntentId && !booking.stripe_payment_intent_id
              ? { stripe_payment_intent_id: paymentIntentId }
              : {}),
          })
          .eq('id', session.metadata.booking_id);

        if (bookingUpdateError) {
          console.error('Error updating booking payment status:', bookingUpdateError);
        } else {
          console.info(`Successfully updated payment status for booking: ${session.metadata.booking_id}`);
        }

        if (booking.deposit_amount && parseFloat(booking.deposit_amount) > 0 && paymentIntentId) {
          const { data: listing } = await supabase
            .from('listings')
            .select('landlord_id')
            .eq('id', booking.listing_id)
            .maybeSingle();

          if (listing?.landlord_id) {
            const { error: depositError } = await supabase
              .from('deposit_transactions')
              .upsert(
                {
                  booking_id: booking.id,
                  listing_id: booking.listing_id,
                  landlord_id: listing.landlord_id,
                  student_id: booking.student_id,
                  deposit_amount: parseFloat(booking.deposit_amount),
                  status: 'collected',
                  stripe_payment_intent_id: paymentIntentId,
                  collected_at: new Date().toISOString(),
                },
                { onConflict: 'booking_id' }
              );

            if (depositError) {
              console.error('Error upserting deposit_transaction:', depositError);
            } else {
              console.info(`Successfully upserted deposit_transaction for booking: ${booking.id}`);
            }
          }
        }
      } catch (error) {
        console.error('Error processing first rent payment:', error);
      }

      return;
    }

    if (session.metadata?.payment_type === 'monthly_rent' && session.metadata?.payment_id) {
      console.info(`Processing monthly rent payment: ${session.metadata.payment_id}`);

      try {
        const { data: existingPayment } = await supabase
          .from('rent_payments')
          .select('status')
          .eq('id', session.metadata.payment_id)
          .maybeSingle();

        if (existingPayment?.status === 'paid') {
          console.info(`Rent payment ${session.metadata.payment_id} already paid, skipping`);
          return;
        }

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
  }

  if (event.type === 'checkout.session.async_payment_failed') {
    const session = stripeData as Stripe.Checkout.Session;
    console.info(`Processing async payment failure for session: ${session.id}`);

    try {
      if (session.metadata?.payment_type === 'first_payment' && session.metadata?.booking_id) {
        await supabase
          .from('bookings')
          .update({ payment_status: 'failed' })
          .eq('id', session.metadata.booking_id);
        console.info(`Marked booking ${session.metadata.booking_id} as failed`);
      } else if (session.metadata?.payment_type === 'monthly_rent' && session.metadata?.payment_id) {
        await supabase
          .from('rent_payments')
          .update({ status: 'failed' })
          .eq('id', session.metadata.payment_id);
        console.info(`Marked rent payment ${session.metadata.payment_id} as failed`);
      }
    } catch (error) {
      console.error('Error processing async payment failure:', error);
    }

    return;
  }

  // Handle direct charges on landlord Stripe Connect accounts (premium subscription)
  if (event.type === 'charge.succeeded') {
    const charge = stripeData as Stripe.Charge;

    if (charge.metadata?.type === 'premium_subscription' && charge.metadata?.landlord_id) {
      console.info(`Processing premium subscription charge: ${charge.id} for landlord: ${charge.metadata.landlord_id}`);

      try {
        const invoiceId = `${charge.metadata.auto_charge === 'true' ? 'auto' : 'manual'}_${charge.id}`;

        // Check if invoice already exists
        const { data: existingInvoice } = await supabase
          .from('invoices')
          .select('id')
          .eq('stripe_invoice_id', invoiceId)
          .maybeSingle();

        if (existingInvoice) {
          console.info(`Invoice ${invoiceId} already exists, skipping`);
          return;
        }

        // Record the invoice
        const { error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            user_id: charge.metadata.landlord_id,
            stripe_invoice_id: invoiceId,
            amount: charge.amount,
            currency: charge.currency,
            status: 'paid',
            billing_reason: charge.metadata.auto_charge === 'true' ? 'automatic_monthly_charge' : 'manual_admin_charge',
          });

        if (invoiceError) {
          console.error('Error inserting premium subscription invoice:', invoiceError);
        } else {
          console.info(`Successfully recorded premium subscription charge: ${charge.id}`);
        }
      } catch (error) {
        console.error('Error processing premium subscription charge:', error);
      }

      return;
    }
  }

  // Only process subscription sync / one-time order insertion for checkout.session.completed events
  // that were NOT already handled above (first_payment / monthly_rent return early).
  // Other event types (charge.refunded, payment_intent.*, etc.) should not fall through here.
  if (event.type !== 'checkout.session.completed') {
    return;
  }

  if (!('customer' in stripeData)) {
    return;
  }

  // for one time payments, we only listen for the checkout.session.completed event
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
    if (pricingPlan && pricingPlan.price > 0) {
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
