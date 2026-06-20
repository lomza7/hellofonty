import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { STRIPE_PRODUCTS, StripeProduct } from '../stripe-config';

export interface StripeSubscriptionStatus {
  isActive: boolean;
  priceId: string | null;
  subscriptionId: string | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  product: StripeProduct | null;
  loading: boolean;
}

export function useStripeSubscription() {
  const [status, setStatus] = useState<StripeSubscriptionStatus>({
    isActive: false,
    priceId: null,
    subscriptionId: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    product: null,
    loading: true,
  });

  useEffect(() => {
    fetchSubscription();
  }, []);

  async function fetchSubscription() {
    try {
      const { data, error } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .maybeSingle();

      if (error || !data) {
        setStatus(s => ({ ...s, loading: false }));
        return;
      }

      const activeStatuses = ['active', 'trialing'];
      const isActive = activeStatuses.includes(data.subscription_status ?? '');

      const matchedProduct = isActive && data.price_id
        ? (Object.values(STRIPE_PRODUCTS).find(p => p.priceId === data.price_id) ?? null)
        : null;

      setStatus({
        isActive,
        priceId: data.price_id ?? null,
        subscriptionId: data.subscription_id ?? null,
        currentPeriodEnd: data.current_period_end ?? null,
        cancelAtPeriodEnd: data.cancel_at_period_end ?? false,
        product: matchedProduct,
        loading: false,
      });
    } catch {
      setStatus(s => ({ ...s, loading: false }));
    }
  }

  return { ...status, refresh: fetchSubscription };
}