-- Phase 1: Restrict subscriptions UPDATE columns
-- The frontend never directly updates subscriptions - cancellation goes through
-- the stripe-cancel-subscription edge function (service role).
-- The "Users can update own subscription" policy allowed users to change their
-- plan_type from 'free' to 'premium' without paying.

-- Drop the dangerous permissive policy
DROP POLICY IF EXISTS "Users can update own subscription" ON subscriptions;

-- Revoke UPDATE from authenticated
REVOKE UPDATE ON subscriptions FROM authenticated;

-- Grant UPDATE only on cancel_at_period_end (in case it's needed in the future)
-- Actually, since the edge function uses service role, we don't need any user UPDATE
-- Keep admin UPDATE policy only
-- The admin policy "Admin can update all subscriptions" uses authenticated role
-- so we need to grant UPDATE on all columns to authenticated and rely on RLS
GRANT UPDATE ON subscriptions TO authenticated;
