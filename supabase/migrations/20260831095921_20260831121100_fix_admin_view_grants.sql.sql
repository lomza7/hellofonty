-- Revoke all privileges from authenticated on admin_subscription_overview and grant only SELECT
REVOKE ALL ON admin_subscription_overview FROM authenticated;
GRANT SELECT ON admin_subscription_overview TO authenticated;
