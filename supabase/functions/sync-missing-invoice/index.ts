import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get the user's stripe customer ID
    const { data: customerData, error: customerError } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (customerError || !customerData) {
      return new Response(
        JSON.stringify({ error: 'No Stripe customer found for this user' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const customerId = customerData.customer_id;

    // Fetch the latest invoice from Stripe
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 10,
      status: 'paid',
    });

    if (invoices.data.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No paid invoices found in Stripe' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    let syncedCount = 0;
    const errors = [];

    for (const invoice of invoices.data) {
      // Check if invoice already exists
      const { data: existingInvoice } = await supabase
        .from('invoices')
        .select('id')
        .eq('stripe_invoice_id', invoice.id)
        .maybeSingle();

      if (existingInvoice) {
        console.info(`Invoice ${invoice.id} already exists, skipping`);
        continue;
      }

      // Insert the invoice
      const { error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
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
        errors.push({ invoice_id: invoice.id, error: invoiceError.message });
      } else {
        console.info(`Successfully inserted invoice: ${invoice.id}`);
        syncedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        message: `Successfully synced ${syncedCount} invoice(s)`,
        synced: syncedCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error syncing invoices:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
