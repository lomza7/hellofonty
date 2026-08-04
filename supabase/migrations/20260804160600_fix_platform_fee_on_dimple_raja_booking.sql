/*
  # Fix platform_fee on Dimple Raja's booking

  1. Problem
    - Booking 1da6be26-3d4a-4ead-85d9-c61c2dce970c (Dimple Raja) has
      platform_fee = 0 but service_fee = 299. The 299 EUR fee was correctly
      charged to the student via Stripe, but the platform_fee column was
      never populated by the trigger.

  2. Fix
    - Set platform_fee = 299 on this booking so it reflects the actual
      fee collected.
*/

UPDATE bookings
SET platform_fee = 299
WHERE id = '1da6be26-3d4a-4ead-85d9-c61c2dce970c';
