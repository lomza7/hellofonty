import { supabase } from '../lib/supabase';

interface CheckoutOptions {
  priceId: string;
  mode: 'subscription' | 'payment';
  successUrl?: string;
  cancelUrl?: string;
}

export async function createCheckoutSession(options: CheckoutOptions): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Vous devez être connecté pour procéder au paiement.');
  }

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      price_id: options.priceId,
      mode: options.mode,
      success_url: options.successUrl ?? `${window.location.origin}/checkout/success`,
      cancel_url: options.cancelUrl ?? `${window.location.origin}/pricing`,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message ?? 'Erreur lors de la création de la session de paiement.');
  }

  const data = await response.json();

  if (!data.url) {
    throw new Error('URL de paiement manquante dans la réponse.');
  }

  return data.url;
}