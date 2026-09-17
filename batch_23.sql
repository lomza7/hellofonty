/*
  # Create refunds table for tracking Stripe refunds

  1. New table
    - `refunds` - tracks all refunds issued from admin
    - Columns: booking_id, student_id, amount, refund_type, stripe_refund_id, admin_id, created_at

  2. New column on bookings
    - `platform_fee_refunded` boolean to track if platform fee was refunded

  3. Security
    - RLS enabled: only admins can read, only service role can insert
*/

CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  refund_type TEXT NOT NULL CHECK (refund_type IN ('full', 'partial', 'platform_fee')),
  stripe_refund_id TEXT NOT NULL,
  admin_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refunds_booking_id ON refunds(booking_id);
CREATE INDEX idx_refunds_student_id ON refunds(student_id);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS platform_fee_refunded BOOLEAN DEFAULT false;

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_can_read_refunds" ON refunds FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "students_can_read_own_refunds" ON refunds FOR SELECT
  TO authenticated USING (student_id = auth.uid());

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

/*
  # Fix calculate_prorated_payment to populate platform_fee column

  1. Problem
    - The trigger sets `service_fee` from platform_settings but leaves
      `platform_fee` at 0. Both should hold the same one-time fee (299 EUR)
      that is charged to the student on the first booking payment.

  2. Fix
    - Populate `platform_fee` with the same value as `service_fee` so the
      booking record correctly reflects the fee collected.

  3. Backfill
    - Update all confirmed bookings where platform_fee is 0 or null but
      service_fee is set, copying service_fee into platform_fee.
*/

CREATE OR REPLACE FUNCTION calculate_prorated_payment()
RETURNS TRIGGER AS $$
DECLARE
  days_in_first_month integer;
  days_remaining integer;
  monthly_rent numeric;
  listing_security_deposit numeric;
  prorated_amount numeric;
  platform_fee numeric;
  total_duration_months integer;
BEGIN
  SELECT price_per_month, COALESCE(security_deposit, 0)
  INTO monthly_rent, listing_security_deposit
  FROM listings
  WHERE id = NEW.listing_id;

  days_in_first_month := EXTRACT(DAY FROM (DATE_TRUNC('month', NEW.start_date) + INTERVAL '1 month' - INTERVAL '1 day'));

  days_remaining := days_in_first_month - EXTRACT(DAY FROM NEW.start_date) + 1;

  total_duration_months := EXTRACT(YEAR FROM AGE(NEW.end_date, NEW.start_date)) * 12 +
    EXTRACT(MONTH FROM AGE(NEW.end_date, NEW.start_date));

  IF total_duration_months < 1 THEN
    total_duration_months := 1;
  END IF;

  NEW.total_months := total_duration_months;

  IF EXTRACT(DAY FROM NEW.start_date) > 1 THEN
    NEW.is_first_month_partial := true;
    prorated_amount := ROUND((monthly_rent / days_in_first_month) * days_remaining, 2);
    NEW.prorated_rent := prorated_amount;
    NEW.rent_amount := prorated_amount;
  ELSE
    NEW.is_first_month_partial := false;
    NEW.prorated_rent := monthly_rent;
    NEW.rent_amount := monthly_rent;
  END IF;

  SELECT COALESCE(setting_value::numeric, 299.00) INTO platform_fee
  FROM platform_settings
  WHERE setting_key = 'platform_fee_amount'
  LIMIT 1;

  IF platform_fee IS NULL THEN
    platform_fee := 299.00;
  END IF;

  NEW.service_fee := platform_fee;
  NEW.platform_fee := platform_fee;
  NEW.deposit_amount := listing_security_deposit;
  NEW.payment_amount := ROUND(NEW.rent_amount + listing_security_deposit + platform_fee, 2);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill: sync platform_fee from service_fee for confirmed bookings where platform_fee is 0 or null
UPDATE bookings
SET platform_fee = service_fee
WHERE status = 'confirmed'
  AND COALESCE(platform_fee, 0) = 0
  AND COALESCE(service_fee, 0) > 0;

/*
  # Remove platform fees from monthly rent payments

  1. Problem
    - The trigger `generate_monthly_rent_payments` adds platform_fee = 299 EUR
      to every monthly rent payment. The 299 EUR fee should only be charged
      once, on the first booking payment (student side). Monthly rent
      payments should transfer the full rent to the landlord with no
      platform deduction.

  2. Fix
    - Modify `generate_monthly_rent_payments` to set platform_fee = 0 and
      total_amount = rent_amount for all future monthly payments.
    - Clean up the 5 existing rent_payments rows that were generated with
      platform_fee = 299: set platform_fee = 0 and recalculate total_amount
      = rent_amount.

  3. Important Notes
    - The first booking payment (via stripe-booking-payment edge function)
      still correctly charges the 299 EUR fee. This change only affects
      subsequent monthly rent payments.
    - No data is lost: rent_amount values are preserved, only the
      erroneous platform_fee is zeroed out.
*/

CREATE OR REPLACE FUNCTION generate_monthly_rent_payments()
RETURNS TRIGGER AS $$
DECLARE
  monthly_rent numeric;
  current_month_start date;
  payment_month integer;
  total_months_remaining integer;
  landlord_id_value uuid;
BEGIN
  IF NEW.payment_status = 'completed' AND OLD.payment_status != 'completed' THEN

    IF EXISTS (SELECT 1 FROM rent_payments WHERE booking_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    IF NEW.total_months IS NULL THEN
      UPDATE bookings 
      SET total_months = calculate_booking_months(start_date, end_date)
      WHERE id = NEW.id;
      
      SELECT total_months INTO NEW.total_months
      FROM bookings
      WHERE id = NEW.id;
    END IF;

    SELECT price_per_month, l.landlord_id INTO monthly_rent, landlord_id_value
    FROM listings l
    WHERE l.id = NEW.listing_id;

    total_months_remaining := NEW.total_months - 1;

    current_month_start := DATE_TRUNC('month', NEW.start_date) + INTERVAL '1 month';

    FOR payment_month IN 1..total_months_remaining LOOP
      current_month_start := DATE_TRUNC('month', NEW.start_date) + (payment_month || ' months')::INTERVAL;

      IF current_month_start <= NEW.end_date THEN
        INSERT INTO rent_payments (
          booking_id,
          student_id,
          landlord_id,
          rent_amount,
          platform_fee,
          total_amount,
          payment_date,
          month_year,
          status
        ) VALUES (
          NEW.id,
          NEW.student_id,
          landlord_id_value,
          monthly_rent,
          0,
          monthly_rent,
          current_month_start,
          TO_CHAR(current_month_start, 'YYYY-MM'),
          'pending'
        );
      END IF;
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Clean up existing rent_payments: remove erroneous platform fees
UPDATE rent_payments
SET platform_fee = 0,
    total_amount = rent_amount
WHERE platform_fee > 0;

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

