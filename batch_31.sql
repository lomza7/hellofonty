-- Phase 1: Restrict profiles UPDATE columns
-- Users can only update their own non-sensitive columns directly.
-- Sensitive columns (role, is_verified, verification_*, stripe_*, subscription_exempt*) 
-- are only writable by admins (via their policy) or the service_role (webhooks/triggers).

-- Revoke broad UPDATE on profiles from authenticated
REVOKE UPDATE ON profiles FROM authenticated;

-- Grant UPDATE only on user-editable columns to authenticated
GRANT UPDATE (
  first_name,
  last_name,
  phone,
  avatar_url,
  preferred_language,
  preferred_lease_type,
  verification_document_url,
  verification_status,
  verification_submitted_at
) ON profiles TO authenticated;

-- Create a SECURITY DEFINER function for updating stripe_migration_needed
-- (called from Payouts.tsx by the landlord themselves)
CREATE OR REPLACE FUNCTION update_stripe_migration_needed(p_needed boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET stripe_migration_needed = p_needed WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION update_stripe_migration_needed FROM anon;
GRANT EXECUTE ON FUNCTION update_stripe_migration_needed TO authenticated;

-- Phase 1b: Create SECURITY DEFINER function for admin verification updates
-- Admins update verification_status, verification_reviewed_at, verification_rejection_reason
-- These columns are revoked from authenticated, so admin needs a privileged function

CREATE OR REPLACE FUNCTION admin_update_verification_status(
  p_user_id uuid,
  p_status text,
  p_rejection_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Validate status value
  IF p_status NOT IN ('approved', 'rejected', 'pending', 'not_submitted') THEN
    RAISE EXCEPTION 'Invalid verification status';
  END IF;

  UPDATE profiles
  SET
    verification_status = p_status,
    verification_reviewed_at = now(),
    verification_rejection_reason = CASE
      WHEN p_status = 'rejected' THEN p_rejection_reason
      ELSE NULL
    END,
    is_verified = (p_status = 'approved')
  WHERE id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_update_verification_status FROM anon;
GRANT EXECUTE ON FUNCTION admin_update_verification_status TO authenticated;

-- Phase 1: Fix rent_payments open write policies
-- The "System can update rent payments" policy had USING(true) WITH CHECK(true)
-- which allowed ANY authenticated user to modify ANY rent payment.
-- The "System can insert rent payments" policy had WITH CHECK(true)
-- which allowed ANY authenticated user to insert fake payments.
-- Triggers and cron use service_role which bypasses RLS, so these permissive policies are unnecessary.

DROP POLICY IF EXISTS "System can update rent payments" ON rent_payments;
DROP POLICY IF EXISTS "System can insert rent payments" ON rent_payments;

-- Keep the legitimate policies:
-- "Students can view own rent payments" (student_id = auth.uid())
-- "Landlords can view rent payments for their bookings" (landlord_id = auth.uid())
-- "Admins can view all rent payments" (role = admin)
-- "Admins can update rent payments" (role = admin)
-- "Managers can view rent payments for assigned listings"
-- "Managers can update rent payments for assigned listings"

-- Add a policy for students to UPDATE their own rent payments (e.g. auto_reminder_enabled toggle)
CREATE POLICY "Students can update own rent payments" ON rent_payments
  FOR UPDATE TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- Add a policy for landlords to UPDATE rent payments for their bookings
CREATE POLICY "Landlords can update rent payments for their bookings" ON rent_payments
  FOR UPDATE TO authenticated
  USING (auth.uid() = landlord_id)
  WITH CHECK (auth.uid() = landlord_id);

-- Add DELETE policies for rent_payments
-- Landlords delete rent_payments when cancelling a booking (from Leases.tsx and MyBookingRequests.tsx)
CREATE POLICY "Landlords can delete rent payments for their bookings" ON rent_payments
  FOR DELETE TO authenticated
  USING (auth.uid() = landlord_id);

-- Admins can also delete rent payments
CREATE POLICY "Admins can delete rent payments" ON rent_payments
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- Phase 1: Revoke EXECUTE from anon on all SECURITY DEFINER functions
-- Then grant EXECUTE to authenticated ONLY for functions called from the frontend

-- Revoke EXECUTE from anon for ALL security definer functions
-- (anon should never call internal functions directly)
REVOKE EXECUTE ON FUNCTION auto_send_payment_message FROM anon;
REVOKE EXECUTE ON FUNCTION calculate_mrr FROM anon;
REVOKE EXECUTE ON FUNCTION can_manage_listing FROM anon;
REVOKE EXECUTE ON FUNCTION charge_landlord_subscriptions FROM anon;
REVOKE EXECUTE ON FUNCTION cleanup_old_imported_dates FROM anon;
REVOKE EXECUTE ON FUNCTION cleanup_old_verification_attempts FROM anon;
REVOKE EXECUTE ON FUNCTION cleanup_old_verification_codes FROM anon;
REVOKE EXECUTE ON FUNCTION complete_landlord_document_task FROM anon;
REVOKE EXECUTE ON FUNCTION complete_phone_task FROM anon;
REVOKE EXECUTE ON FUNCTION complete_profile_photo_task FROM anon;
REVOKE EXECUTE ON FUNCTION complete_stripe_onboarding_task FROM anon;
REVOKE EXECUTE ON FUNCTION complete_student_document_task FROM anon;
REVOKE EXECUTE ON FUNCTION expire_overdue_bookings FROM anon;
REVOKE EXECUTE ON FUNCTION generate_profile_verification_tasks FROM anon;
REVOKE EXECUTE ON FUNCTION get_access_guide_by_token FROM anon;
REVOKE EXECUTE ON FUNCTION get_blocked_messages_stats FROM anon;
REVOKE EXECUTE ON FUNCTION get_daily_activity FROM anon;
REVOKE EXECUTE ON FUNCTION get_daily_booking_growth FROM anon;
REVOKE EXECUTE ON FUNCTION get_daily_listing_growth FROM anon;
REVOKE EXECUTE ON FUNCTION get_daily_user_growth FROM anon;
REVOKE EXECUTE ON FUNCTION get_my_access_guide FROM anon;
REVOKE EXECUTE ON FUNCTION get_platform_setting FROM anon;
REVOKE EXECUTE ON FUNCTION get_user_blocked_attempts_count FROM anon;
REVOKE EXECUTE ON FUNCTION get_user_email FROM anon;
REVOKE EXECUTE ON FUNCTION handle_booking_cancellation FROM anon;
REVOKE EXECUTE ON FUNCTION handle_new_user_profile FROM anon;
REVOKE EXECUTE ON FUNCTION is_admin FROM anon;
REVOKE EXECUTE ON FUNCTION is_assigned_manager FROM anon;
REVOKE EXECUTE ON FUNCTION notify_booking_email FROM anon;
REVOKE EXECUTE ON FUNCTION notify_booking_status_change FROM anon;
REVOKE EXECUTE ON FUNCTION relaunch_booking_payment FROM anon;
REVOKE EXECUTE ON FUNCTION send_system_message FROM anon;
REVOKE EXECUTE ON FUNCTION trigger_generate_profile_verification_tasks FROM anon;
REVOKE EXECUTE ON FUNCTION update_listing_bookings_count FROM anon;
REVOKE EXECUTE ON FUNCTION update_listing_favorites_count FROM anon;
REVOKE EXECUTE ON FUNCTION update_listing_statistics FROM anon;
REVOKE EXECUTE ON FUNCTION validate_booking_duration FROM anon;
REVOKE EXECUTE ON FUNCTION validate_lease_duration FROM anon;

-- Also revoke EXECUTE from authenticated for functions that are ONLY used by triggers/cron
-- (not called from frontend code)
REVOKE EXECUTE ON FUNCTION auto_send_payment_message FROM authenticated;
REVOKE EXECUTE ON FUNCTION calculate_mrr FROM authenticated;
REVOKE EXECUTE ON FUNCTION charge_landlord_subscriptions FROM authenticated;
REVOKE EXECUTE ON FUNCTION cleanup_old_imported_dates FROM authenticated;
REVOKE EXECUTE ON FUNCTION cleanup_old_verification_attempts FROM authenticated;
REVOKE EXECUTE ON FUNCTION cleanup_old_verification_codes FROM authenticated;
REVOKE EXECUTE ON FUNCTION complete_landlord_document_task FROM authenticated;
REVOKE EXECUTE ON FUNCTION complete_phone_task FROM authenticated;
REVOKE EXECUTE ON FUNCTION complete_profile_photo_task FROM authenticated;
REVOKE EXECUTE ON FUNCTION complete_stripe_onboarding_task FROM authenticated;
REVOKE EXECUTE ON FUNCTION complete_student_document_task FROM authenticated;
REVOKE EXECUTE ON FUNCTION expire_overdue_bookings FROM authenticated;
REVOKE EXECUTE ON FUNCTION generate_profile_verification_tasks FROM authenticated;
REVOKE EXECUTE ON FUNCTION handle_booking_cancellation FROM authenticated;
REVOKE EXECUTE ON FUNCTION handle_new_user_profile FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_booking_email FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_booking_status_change FROM authenticated;
REVOKE EXECUTE ON FUNCTION send_system_message FROM authenticated;
REVOKE EXECUTE ON FUNCTION trigger_generate_profile_verification_tasks FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_listing_bookings_count FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_listing_favorites_count FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_listing_statistics FROM authenticated;
REVOKE EXECUTE ON FUNCTION validate_booking_duration FROM authenticated;
REVOKE EXECUTE ON FUNCTION validate_lease_duration FROM authenticated;

-- Keep EXECUTE on authenticated for functions called from the frontend:
-- get_user_email, get_access_guide_by_token, get_daily_user_growth, get_daily_listing_growth,
-- get_daily_booking_growth, get_daily_activity, get_blocked_messages_stats,
-- get_user_blocked_attempts_count, get_my_access_guide, relaunch_booking_payment,
-- is_admin, is_assigned_manager, can_manage_listing, get_platform_setting

