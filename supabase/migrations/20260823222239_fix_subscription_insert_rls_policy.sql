-- Fix: subscriptions INSERT policy allowed any plan_type, including 'premium'
-- This is a privilege escalation - users could self-assign premium for free.
-- Restrict INSERT to plan_type = 'free' only. Premium is granted server-side
-- via Stripe webhook.

DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;

CREATE POLICY "Users can insert own free subscription"
  ON public.subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND plan_type = 'free');
