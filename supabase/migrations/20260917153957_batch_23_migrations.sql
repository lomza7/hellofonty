-- Create refunds table for tracking Stripe refunds
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

DROP POLICY IF EXISTS "admins_can_read_refunds" ON refunds;
CREATE POLICY "admins_can_read_refunds" ON refunds FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "students_can_read_own_refunds" ON refunds;
CREATE POLICY "students_can_read_own_refunds" ON refunds FOR SELECT
  TO authenticated USING (student_id = auth.uid());

-- Fix platform_fee on Dimple Raja's booking
UPDATE bookings
SET platform_fee = 299
WHERE id = '1da6be26-3d4a-4ead-85d9-c61c2dce970c';

-- Fix calculate_prorated_payment to populate platform_fee column
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

-- Backfill: sync platform_fee from service_fee
UPDATE bookings
SET platform_fee = service_fee
WHERE status = 'confirmed'
  AND COALESCE(platform_fee, 0) = 0
  AND COALESCE(service_fee, 0) > 0;

-- Remove platform fees from monthly rent payments
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

-- Remove legacy 10% booking fee trigger
DROP TRIGGER IF EXISTS calculate_fees_trigger ON bookings;
DROP FUNCTION IF EXISTS calculate_booking_fees();
