-- Phase 2: Fix admin_subscription_overview view
-- 1. Drop and recreate as a normal view (not SECURITY DEFINER)
-- 2. Revoke all grants from anon
-- 3. Only grant SELECT to authenticated

DROP VIEW IF EXISTS admin_subscription_overview;

CREATE VIEW admin_subscription_overview AS
SELECT 
  p.id AS user_id,
  p.first_name,
  p.last_name,
  p.role,
  s.plan_type,
  s.status AS subscription_status,
  s.current_period_start,
  s.current_period_end,
  s.cancel_at_period_end,
  s.stripe_customer_id,
  s.stripe_subscription_id,
  s.stripe_price_id,
  s.created_at AS subscription_created_at,
  s.updated_at AS subscription_updated_at
FROM profiles p
LEFT JOIN subscriptions s ON p.id = s.user_id
WHERE p.role = 'landlord'
ORDER BY s.created_at DESC;

-- Revoke all from anon
REVOKE ALL ON admin_subscription_overview FROM anon;

-- Grant only SELECT to authenticated
GRANT SELECT ON admin_subscription_overview TO authenticated;
