import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecret) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeSecret, {
      appInfo: { name: 'Bolt Integration', version: '1.0.0' },
    });

    const { price_id, product_id } = await req.json();

    if (price_id) {
      const price = await stripe.prices.retrieve(price_id, { expand: ['product'] });
      const product = price.product as Stripe.Product;

      return new Response(
        JSON.stringify({
          price_id: price.id,
          product_id: product.id,
          amount: price.unit_amount ? price.unit_amount / 100 : 0,
          currency: price.currency,
          interval: price.recurring?.interval || null,
          product_name: product.name,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (product_id) {
      const prices = await stripe.prices.list({
        product: product_id,
        active: true,
        limit: 10,
      });

      const product = await stripe.products.retrieve(product_id);

      const pricesList = prices.data.map((p) => ({
        price_id: p.id,
        amount: p.unit_amount ? p.unit_amount / 100 : 0,
        currency: p.currency,
        interval: p.recurring?.interval || null,
      }));

      return new Response(
        JSON.stringify({
          product_id: product.id,
          product_name: product.name,
          prices: pricesList,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'price_id or product_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
