/*
  # Remove legacy 10% booking fee trigger

  1. Problem
    - The trigger `calculate_fees_trigger` fires BEFORE INSERT OR UPDATE
      on `bookings` and sets `service_fee = total_price * 0.10` and
      `landlord_payout = total_price * 0.90`. This is a vestige of an old
      percentage-based fee model that has been replaced by the fixed
      299 EUR platform fee handled by `calculate_prorated_payment`.
    - Although `calculate_prorated_payment` overwrites `service_fee` on
      confirmation, the 10% calculation still runs first and can briefly
      set incorrect values, causing confusion.

  2. Fix
    - Drop the `calculate_fees_trigger` trigger.
    - Drop the `calculate_booking_fees()` function (no longer called).

  3. Important Notes
    - The fixed 299 EUR fee is unaffected: `calculate_prorated_payment`
      remains the sole function responsible for setting `service_fee`,
      `platform_fee`, and `payment_amount` on confirmed bookings.
    - No data is lost; only a trigger and its function are removed.
*/

DROP TRIGGER IF EXISTS calculate_fees_trigger ON bookings;
DROP FUNCTION IF EXISTS calculate_booking_fees();
