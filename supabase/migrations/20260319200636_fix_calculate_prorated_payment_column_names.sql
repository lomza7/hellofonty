/*
  # Fix calculate_prorated_payment() function

  1. Problem
    - The function references `monthly_price` column which does not exist in the `listings` table
    - The correct column name is `price_per_month`
    - The function also references `platform_fee_amount` column directly on `platform_settings` 
      table, but the table uses key-value format (`setting_key` / `setting_value`)
    - This causes a fatal error when a landlord tries to confirm a booking

  2. Fix
    - Replace `monthly_price` with `price_per_month`
    - Fix platform fee lookup to use key-value query on `platform_settings`
*/

CREATE OR REPLACE FUNCTION calculate_prorated_payment()
RETURNS TRIGGER AS $$
DECLARE
  days_in_first_month integer;
  days_remaining integer;
  monthly_rent numeric;
  prorated_amount numeric;
  platform_fee numeric;
  total_duration_months integer;
BEGIN
  SELECT price_per_month INTO monthly_rent
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

  SELECT COALESCE(setting_value::numeric, 50.00) INTO platform_fee
  FROM platform_settings
  WHERE setting_key = 'platform_fee_amount'
  LIMIT 1;

  IF platform_fee IS NULL THEN
    platform_fee := 50.00;
  END IF;

  NEW.service_fee := platform_fee;

  NEW.payment_amount := NEW.rent_amount + platform_fee;

  NEW.deposit_amount := 0;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
