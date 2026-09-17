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

-- Revoke all privileges from authenticated on admin_subscription_overview and grant only SELECT
REVOKE ALL ON admin_subscription_overview FROM authenticated;
GRANT SELECT ON admin_subscription_overview TO authenticated;

-- Phase 3: Add missing indexes on foreign keys
-- These indexes improve query performance for joins and lookups

CREATE INDEX IF NOT EXISTS idx_blocked_dates_created_by ON blocked_dates(created_by);
CREATE INDEX IF NOT EXISTS idx_blocked_messages_booking_id ON blocked_messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_inventory_signatures_signer_id ON inventory_signatures(signer_id);
CREATE INDEX IF NOT EXISTS idx_manager_assignments_assigned_by ON manager_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_property_inventories_booking_id ON property_inventories(booking_id);
CREATE INDEX IF NOT EXISTS idx_property_inventories_check_in_inventory_id ON property_inventories(check_in_inventory_id);
CREATE INDEX IF NOT EXISTS idx_property_inventories_lease_id ON property_inventories(lease_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_sender_id ON support_messages(sender_id);

-- Phase 3: Fix search_path on all SECURITY DEFINER functions
-- Also fix non-SECURITY DEFINER plpgsql functions

-- SECURITY DEFINER functions
ALTER FUNCTION auto_send_payment_message() SET search_path = public, pg_temp;
ALTER FUNCTION calculate_mrr() SET search_path = public, pg_temp;
ALTER FUNCTION can_manage_listing(p_listing_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION charge_landlord_subscriptions() SET search_path = public, pg_temp;
ALTER FUNCTION cleanup_old_imported_dates() SET search_path = public, pg_temp;
ALTER FUNCTION cleanup_old_verification_attempts() SET search_path = public, pg_temp;
ALTER FUNCTION cleanup_old_verification_codes() SET search_path = public, pg_temp;
ALTER FUNCTION complete_landlord_document_task() SET search_path = public, pg_temp;
ALTER FUNCTION complete_phone_task() SET search_path = public, pg_temp;
ALTER FUNCTION complete_profile_photo_task() SET search_path = public, pg_temp;
ALTER FUNCTION complete_stripe_onboarding_task() SET search_path = public, pg_temp;
ALTER FUNCTION complete_student_document_task() SET search_path = public, pg_temp;
ALTER FUNCTION expire_overdue_bookings() SET search_path = public, pg_temp;
ALTER FUNCTION generate_profile_verification_tasks(profile_id uuid, user_role text) SET search_path = public, pg_temp;
ALTER FUNCTION get_blocked_messages_stats() SET search_path = public, pg_temp;
ALTER FUNCTION get_daily_activity(days integer) SET search_path = public, pg_temp;
ALTER FUNCTION get_daily_booking_growth(days integer) SET search_path = public, pg_temp;
ALTER FUNCTION get_daily_listing_growth(days integer) SET search_path = public, pg_temp;
ALTER FUNCTION get_daily_user_growth(days integer) SET search_path = public, pg_temp;
ALTER FUNCTION get_platform_setting(p_key text) SET search_path = public, pg_temp;
ALTER FUNCTION get_user_blocked_attempts_count(target_user_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION get_user_email(user_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION handle_booking_cancellation() SET search_path = public, pg_temp;
ALTER FUNCTION is_admin() SET search_path = public, pg_temp;
ALTER FUNCTION is_assigned_manager(p_listing_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION notify_booking_email() SET search_path = public, pg_temp;
ALTER FUNCTION notify_booking_status_change() SET search_path = public, pg_temp;
ALTER FUNCTION relaunch_booking_payment(p_booking_id uuid) SET search_path = public, pg_temp;
ALTER FUNCTION send_system_message(p_booking_id uuid, p_message text, p_event text) SET search_path = public, pg_temp;
ALTER FUNCTION trigger_generate_profile_verification_tasks() SET search_path = public, pg_temp;
ALTER FUNCTION update_listing_bookings_count() SET search_path = public, pg_temp;
ALTER FUNCTION update_listing_favorites_count() SET search_path = public, pg_temp;
ALTER FUNCTION update_listing_statistics() SET search_path = public, pg_temp;
ALTER FUNCTION validate_booking_duration() SET search_path = public, pg_temp;
ALTER FUNCTION validate_lease_duration() SET search_path = public, pg_temp;

-- Non-SECURITY DEFINER plpgsql functions
ALTER FUNCTION calculate_booking_months(start_date date, end_date date) SET search_path = public, pg_temp;
ALTER FUNCTION calculate_prorated_payment() SET search_path = public, pg_temp;
ALTER FUNCTION generate_monthly_rent_payments() SET search_path = public, pg_temp;
ALTER FUNCTION get_platform_fee() SET search_path = public, pg_temp;
ALTER FUNCTION notify_new_booking_request() SET search_path = public, pg_temp;
ALTER FUNCTION notify_new_message() SET search_path = public, pg_temp;
ALTER FUNCTION set_booking_total_months() SET search_path = public, pg_temp;
ALTER FUNCTION set_payment_deadline() SET search_path = public, pg_temp;
ALTER FUNCTION sync_verification_status() SET search_path = public, pg_temp;
ALTER FUNCTION update_blog_posts_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_booking_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_deposit_transactions_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_leases_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_lsc_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_partner_offers_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_platform_settings_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_pricing_plans_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_rent_payments_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_tasks_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_updated_at_column() SET search_path = public, pg_temp;

-- Restore table-level grants that were accidentally removed by REVOKE statements
-- The RLS policies already control row-level access; these grants just allow
-- authenticated/anon to use the tables at all.

-- 1. Grant ALL privileges to authenticated on all tables in public schema
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;

-- 2. Grant SELECT to anon on public-facing tables (read-only public content)
GRANT SELECT ON listings TO anon;
GRANT SELECT ON listing_images TO anon;
GRANT SELECT ON listing_statistics TO anon;
GRANT SELECT ON blog_posts TO anon;
GRANT SELECT ON blog_categories TO anon;
GRANT SELECT ON blog_tags TO anon;
GRANT SELECT ON blog_post_tags TO anon;
GRANT SELECT ON faqs TO anon;
GRANT SELECT ON pricing_plans TO anon;
GRANT SELECT ON partner_offers TO anon;
GRANT SELECT ON feature_carousel_images TO anon;
GRANT SELECT ON agency_comparison_features TO anon;
GRANT SELECT ON comparison_items TO anon;
GRANT SELECT ON platform_settings TO anon;
GRANT SELECT ON public_profiles TO anon;
GRANT SELECT ON public_bookings TO anon;

-- 3. Add a policy so authenticated users can view landlord profiles
-- (needed for search, listing detail, favorites, payments, deposits, etc.)
CREATE POLICY "Authenticated users can view landlord profiles" ON profiles
  FOR SELECT TO authenticated
  USING (role = 'landlord');

