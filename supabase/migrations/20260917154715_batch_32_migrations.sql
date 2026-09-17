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

-- Revoke EXECUTE from PUBLIC (which includes anon) on all SECURITY DEFINER functions
-- The previous REVOKE FROM anon didn't work because functions default to GRANT EXECUTE TO PUBLIC
-- Wrapped in DO blocks to handle non-existent functions gracefully

DO $$ BEGIN REVOKE EXECUTE ON FUNCTION auto_send_payment_message FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION calculate_mrr FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION can_manage_listing FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION charge_landlord_subscriptions FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION cleanup_old_imported_dates FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION cleanup_old_verification_attempts FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION cleanup_old_verification_codes FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION complete_landlord_document_task FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION complete_phone_task FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION complete_profile_photo_task FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION complete_stripe_onboarding_task FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION complete_student_document_task FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION expire_overdue_bookings FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION generate_profile_verification_tasks FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION get_access_guide_by_token FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION get_blocked_messages_stats FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION get_daily_activity FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION get_daily_booking_growth FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION get_daily_listing_growth FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION get_daily_user_growth FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION get_my_access_guide FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION get_platform_setting FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION get_user_blocked_attempts_count FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION get_user_email FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION handle_booking_cancellation FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION handle_new_user_profile FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION is_admin FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION is_assigned_manager FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION notify_booking_email FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION notify_booking_status_change FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION relaunch_booking_payment FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION send_system_message FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION trigger_generate_profile_verification_tasks FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION update_listing_bookings_count FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION update_listing_favorites_count FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION update_listing_statistics FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION validate_booking_duration FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION validate_lease_duration FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Now grant EXECUTE to authenticated ONLY for functions called from the frontend
DO $$ BEGIN GRANT EXECUTE ON FUNCTION get_user_email TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION get_access_guide_by_token TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION get_daily_user_growth TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION get_daily_listing_growth TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION get_daily_booking_growth TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION get_daily_activity TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION get_blocked_messages_stats TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION get_user_blocked_attempts_count TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION get_my_access_guide TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION relaunch_booking_payment TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION is_admin TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION is_assigned_manager TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION can_manage_listing TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION get_platform_setting TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION update_stripe_migration_needed TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION admin_update_verification_status TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Revoke PUBLIC execute on the two new functions
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION admin_update_verification_status FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN REVOKE EXECUTE ON FUNCTION update_stripe_migration_needed FROM PUBLIC; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Re-grant to authenticated (the REVOKE FROM PUBLIC removed it from authenticated too)
DO $$ BEGIN GRANT EXECUTE ON FUNCTION admin_update_verification_status TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN GRANT EXECUTE ON FUNCTION update_stripe_migration_needed TO authenticated; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Phase 2: Create public_profiles view with only safe columns
-- The profiles table currently exposes ALL columns (including stripe_*, verification_*) 
-- to everyone via the "Profils lisibles publiquement pour les statistiques" policy.
-- This view exposes only the columns needed for public display.

CREATE OR REPLACE VIEW public_profiles AS
SELECT 
  id,
  first_name,
  last_name,
  avatar_url,
  role,
  is_verified,
  created_at
FROM profiles;

-- The view inherits RLS from the underlying table, but since it's a view,
-- we can grant SELECT on it to anon and authenticated
GRANT SELECT ON public_profiles TO anon, authenticated;

-- Drop the permissive public SELECT policies on profiles
DROP POLICY IF EXISTS "Profils lisibles publiquement pour les statistiques" ON profiles;
DROP POLICY IF EXISTS "Profils visibles publiquement pour statistiques" ON profiles;

-- Revoke SELECT from anon on profiles (they should use public_profiles view)
REVOKE SELECT ON profiles FROM anon;

-- Keep SELECT on profiles for authenticated (they need full profile data for messaging, etc.)
-- But add a policy: authenticated users can view profiles of:
-- 1. Themselves
-- 2. Landlords whose listings they've booked (as students)
-- 3. Students who booked their listings (as landlords)
-- 4. Admins (all profiles)
-- 5. Users they share a conversation with

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

DROP POLICY IF EXISTS "Landlords can view profiles of students who booked their listings" ON profiles;
CREATE POLICY "Landlords can view profiles of students who booked their listings" ON profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE l.landlord_id = auth.uid() AND b.student_id = profiles.id
    )
  );

DROP POLICY IF EXISTS "Students can view profiles of landlords whose listings they booked" ON profiles;
CREATE POLICY "Students can view profiles of landlords whose listings they booked" ON profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE b.student_id = auth.uid() AND l.landlord_id = profiles.id
    )
  );

DROP POLICY IF EXISTS "Users can view profiles of conversation partners" ON profiles;
CREATE POLICY "Users can view profiles of conversation partners" ON profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      WHERE (m.sender_id = auth.uid() AND m.recipient_id = profiles.id)
         OR (m.recipient_id = auth.uid() AND m.sender_id = profiles.id)
    )
  );

-- Phase 2: Create public_bookings view for availability calendar
-- The "Anyone can view booking dates for availability" policy exposes ALL booking columns
-- (including payment_amount, rent_amount, deposit_amount, platform_fee, student_id) to everyone.
-- This view exposes only the columns needed for the availability calendar.

CREATE OR REPLACE VIEW public_bookings AS
SELECT 
  id,
  listing_id,
  start_date,
  end_date,
  status
FROM bookings
WHERE status IN ('confirmed', 'pending');

GRANT SELECT ON public_bookings TO anon, authenticated;

-- Drop the permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view booking dates for availability" ON bookings;

-- Revoke SELECT from anon on bookings (they should use public_bookings view)
REVOKE SELECT ON bookings FROM anon;