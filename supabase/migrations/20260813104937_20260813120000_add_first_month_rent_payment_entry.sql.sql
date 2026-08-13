/*
  # Track first month payment in rent_payments

  1. Problem
    - When a student pays the first booking payment (rent + deposit + 299€ fee),
      the booking's payment_status becomes 'completed'.
    - The trigger generate_monthly_rent_payments creates rent_payments rows
      only for months 2 onwards (total_months - 1).
    - The first month payment is tracked only in bookings.payment_status,
      with NO corresponding entry in rent_payments.
    - The landlord dashboard (LandlordRentPayments.tsx) reads exclusively
      from rent_payments, so the first payment is invisible to landlords.

  2. Fix
    - Modify generate_monthly_rent_payments to also insert a first-month
      rent_payments row with status='paid' and paid_at set to now().
    - This row uses the booking's rent_amount (which may be prorated for
      partial first months) and platform_fee = 299 (the one-time fee).
    - total_amount = rent_amount + 299 (matching what the student paid
      for the rent portion + platform fee; deposit is separate).
    - Backfill all existing completed bookings that have rent_payments
      but are missing the first-month entry.

  3. Important Notes
    - The first-month entry is marked 'paid' immediately because the
      booking payment already succeeded (that's what triggered the
      payment_status = 'completed' transition).
    - No data is lost: existing rent_payments rows for months 2+ are
      preserved. Only a new row is inserted for month 1.
    - The is_first_month_partial flag on bookings determines whether
      the first month rent is prorated; we use booking.rent_amount
      which already reflects the correct prorated amount.
*/

CREATE OR REPLACE FUNCTION generate_monthly_rent_payments()
RETURNS TRIGGER AS $$
DECLARE
  monthly_rent numeric;
  first_month_rent numeric;
  platform_fee_amount numeric;
  current_month_start date;
  first_month_start date;
  payment_month integer;
  total_months_remaining integer;
  landlord_id_value uuid;
  first_month_year text;
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

    -- Use the booking's rent_amount for the first month (may be prorated)
    first_month_rent := COALESCE(NEW.rent_amount, monthly_rent);

    -- Platform fee is charged once on the first payment
    SELECT COALESCE(
      (SELECT setting_value::numeric FROM platform_settings WHERE setting_key = 'platform_fee_amount' LIMIT 1),
      299.00
    ) INTO platform_fee_amount;

    -- Create first-month entry (marked as paid since booking payment succeeded)
    first_month_start := DATE_TRUNC('month', NEW.start_date);
    first_month_year := TO_CHAR(first_month_start, 'YYYY-MM');

    INSERT INTO rent_payments (
      booking_id,
      student_id,
      landlord_id,
      rent_amount,
      platform_fee,
      total_amount,
      payment_date,
      month_year,
      status,
      paid_at
    ) VALUES (
      NEW.id,
      NEW.student_id,
      landlord_id_value,
      first_month_rent,
      platform_fee_amount,
      first_month_rent + platform_fee_amount,
      first_month_start,
      first_month_year,
      'paid',
      NOW()
    );

    -- Generate remaining monthly payments (months 2+)
    total_months_remaining := NEW.total_months - 1;

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

-- Backfill: create first-month rent_payments entries for existing completed bookings
-- that already have monthly rent_payments but are missing the first-month entry
INSERT INTO rent_payments (
  booking_id,
  student_id,
  landlord_id,
  rent_amount,
  platform_fee,
  total_amount,
  payment_date,
  month_year,
  status,
  paid_at
)
SELECT
  b.id,
  b.student_id,
  l.landlord_id,
  COALESCE(b.rent_amount, l.price_per_month),
  COALESCE(b.platform_fee, 299.00),
  COALESCE(b.rent_amount, l.price_per_month) + COALESCE(b.platform_fee, 299.00),
  DATE_TRUNC('month', b.start_date)::date,
  TO_CHAR(DATE_TRUNC('month', b.start_date), 'YYYY-MM'),
  'paid',
  NOW()
FROM bookings b
JOIN listings l ON b.listing_id = l.id
WHERE b.payment_status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM rent_payments rp
    WHERE rp.booking_id = b.id
      AND rp.month_year = TO_CHAR(DATE_TRUNC('month', b.start_date), 'YYYY-MM')
  )
  AND EXISTS (
    SELECT 1 FROM rent_payments rp
    WHERE rp.booking_id = b.id
  );
