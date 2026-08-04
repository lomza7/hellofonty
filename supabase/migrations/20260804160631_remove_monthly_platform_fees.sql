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
