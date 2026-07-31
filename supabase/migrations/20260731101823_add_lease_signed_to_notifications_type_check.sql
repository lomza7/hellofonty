/*
# Add lease_signed to notifications type check constraint

1. Modified Tables
   - `notifications`: update the `notifications_type_check` constraint to also include `lease_signed` type.

2. Important Notes
   - This allows sending a notification to the landlord when the tenant signs the lease contract.
*/

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY['message', 'booking_request', 'booking_confirmed', 'booking_cancelled', 'lease_signature_request', 'lease_signed'])
);
