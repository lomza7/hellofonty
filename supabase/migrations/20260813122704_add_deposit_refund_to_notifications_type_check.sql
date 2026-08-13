/*
# Add deposit_refund to notifications type check constraint

1. Modified Tables
   - `notifications`: update the `notifications_type_check` constraint to include `deposit_refund` type.

2. Important Notes
   - This allows sending a notification to the student when the landlord refunds a deposit (full or partial with retention).
*/

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY['message', 'booking_request', 'booking_confirmed', 'booking_cancelled', 'lease_signature_request', 'lease_signed', 'deposit_refund'])
);
