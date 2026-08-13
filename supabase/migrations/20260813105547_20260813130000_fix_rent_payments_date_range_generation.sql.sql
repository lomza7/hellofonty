/*
  # Fix rent_payments generation to use date range, not total_months

  The previous trigger relied on bookings.total_months to decide how many
  rent_payments rows to create. That field is often incorrect (e.g. a 6-month
  booking stored total_months=5), causing missing months in the landlord
  schedule. The student side computes the schedule by iterating from start
  to end date directly — the trigger must do the same.

  This rewrite:
  - Always computes the month list from start_date..end_date
  - Inserts the first month as 'paid' (booking payment already succeeded)
  - Inserts all subsequent months as 'pending'
  - Skips if rent_payments already exist for this booking (idempotent)
*/

CREATE OR REPLACE FUNCTION generate_monthly_rent_payments()
RETURNS TRIGGER AS $$
DECLARE
  monthly_rent numeric;
  first_month_rent numeric;
  platform_fee_amount numeric;
  current_month_start date;
  first_month_start date;
  landlord_id_value uuid;
BEGIN
  IF NEW.payment_status = 'completed' AND OLD.payment_status != 'completed' THEN

    IF EXISTS (SELECT 1 FROM rent_payments WHERE booking_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    SELECT price_per_month, l.landlord_id INTO monthly_rent, landlord_id_value
    FROM listings l
    WHERE l.id = NEW.listing_id;

    first_month_rent := COALESCE(NEW.rent_amount, monthly_rent);

    SELECT COALESCE(
      (SELECT setting_value::numeric FROM platform_settings WHERE setting_key = 'platform_fee_amount' LIMIT 1),
      299.00
    ) INTO platform_fee_amount;

    first_month_start := DATE_TRUNC('month', NEW.start_date)::date;

    -- First month: marked as paid
    INSERT INTO rent_payments (
      booking_id, student_id, landlord_id,
      rent_amount, platform_fee, total_amount,
      payment_date, month_year, status, paid_at
    ) VALUES (
      NEW.id, NEW.student_id, landlord_id_value,
      first_month_rent, platform_fee_amount, first_month_rent + platform_fee_amount,
      first_month_start, TO_CHAR(first_month_start, 'YYYY-MM'),
      'paid', NOW()
    );

    -- Remaining months: iterate from start+1 month until we pass end_date
    current_month_start := (DATE_TRUNC('month', NEW.start_date) + INTERVAL '1 month')::date;

    WHILE current_month_start <= NEW.end_date LOOP
      INSERT INTO rent_payments (
        booking_id, student_id, landlord_id,
        rent_amount, platform_fee, total_amount,
        payment_date, month_year, status
      ) VALUES (
        NEW.id, NEW.student_id, landlord_id_value,
        monthly_rent, 0, monthly_rent,
        current_month_start, TO_CHAR(current_month_start, 'YYYY-MM'),
        'pending'
      );

      current_month_start := (current_month_start + INTERVAL '1 month')::date;
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill: insert any missing months for existing completed bookings
-- where rent_payments exist but don't cover the full date range
DO $$
DECLARE
  b RECORD;
  monthly_rent_val numeric;
  landlord_id_val uuid;
  current_month date;
  first_month date;
  first_month_rent_val numeric;
  platform_fee_val numeric;
BEGIN
  SELECT COALESCE(
    (SELECT setting_value::numeric FROM platform_settings WHERE setting_key = 'platform_fee_amount' LIMIT 1),
    299.00
  ) INTO platform_fee_val;

  FOR b IN SELECT * FROM bookings WHERE payment_status = 'completed' LOOP
    SELECT price_per_month, landlord_id INTO monthly_rent_val, landlord_id_val
    FROM listings WHERE id = b.listing_id;

    IF NOT FOUND THEN CONTINUE; END IF;

    first_month := DATE_TRUNC('month', b.start_date)::date;
    first_month_rent_val := COALESCE(b.rent_amount, monthly_rent_val);

    -- Ensure first month exists (paid)
    IF NOT EXISTS (
      SELECT 1 FROM rent_payments
      WHERE booking_id = b.id AND month_year = TO_CHAR(first_month, 'YYYY-MM')
    ) THEN
      INSERT INTO rent_payments (
        booking_id, student_id, landlord_id,
        rent_amount, platform_fee, total_amount,
        payment_date, month_year, status, paid_at
      ) VALUES (
        b.id, b.student_id, landlord_id_val,
        first_month_rent_val, platform_fee_val, first_month_rent_val + platform_fee_val,
        first_month, TO_CHAR(first_month, 'YYYY-MM'),
        'paid', NOW()
      );
    END IF;

    -- Ensure all subsequent months exist (pending)
    current_month := (DATE_TRUNC('month', b.start_date) + INTERVAL '1 month')::date;

    WHILE current_month <= b.end_date LOOP
      IF NOT EXISTS (
        SELECT 1 FROM rent_payments
        WHERE booking_id = b.id AND month_year = TO_CHAR(current_month, 'YYYY-MM')
      ) THEN
        INSERT INTO rent_payments (
          booking_id, student_id, landlord_id,
          rent_amount, platform_fee, total_amount,
          payment_date, month_year, status
        ) VALUES (
          b.id, b.student_id, landlord_id_val,
          monthly_rent_val, 0, monthly_rent_val,
          current_month, TO_CHAR(current_month, 'YYYY-MM'),
          'pending'
        );
      END IF;

      current_month := (current_month + INTERVAL '1 month')::date;
    END LOOP;
  END LOOP;
END $$;
