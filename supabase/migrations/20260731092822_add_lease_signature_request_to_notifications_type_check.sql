/*
# Add lease_signature_request to notifications type check constraint

1. Modified Tables
   - `notifications`: update the `notifications_type_check` constraint to include `lease_signature_request` type.

2. Important Notes
   - This allows the system to send notifications when a landlord sends a lease contract for tenant signature.
   - Previously, lease notifications silently failed because the type was rejected by the constraint.
*/

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['message'::text, 'booking_request'::text, 'booking_confirmed'::text, 'booking_cancelled'::text, 'lease_signature_request'::text]));
