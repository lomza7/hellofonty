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
