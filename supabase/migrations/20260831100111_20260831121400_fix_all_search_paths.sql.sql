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
