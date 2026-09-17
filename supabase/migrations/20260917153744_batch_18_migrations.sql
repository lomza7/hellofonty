-- Add INSEAD distance cache to listings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'insead_distance_text'
  ) THEN
    ALTER TABLE listings ADD COLUMN insead_distance_text text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'insead_duration_text'
  ) THEN
    ALTER TABLE listings ADD COLUMN insead_duration_text text;
  END IF;
END $$;

-- Add surface_sqm to listings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'surface_sqm'
  ) THEN
    ALTER TABLE listings ADD COLUMN surface_sqm integer;
  END IF;
END $$;

-- Fix inventory signature RLS policies
DROP POLICY IF EXISTS "Landlords can update own draft inventories" ON property_inventories;

CREATE POLICY "Landlords can update own inventories"
  ON property_inventories
  FOR UPDATE
  TO authenticated
  USING (landlord_id = auth.uid())
  WITH CHECK (landlord_id = auth.uid());

DROP POLICY IF EXISTS "Users can sign their inventories" ON inventory_signatures;

CREATE POLICY "Users can sign their inventories"
  ON inventory_signatures
  FOR INSERT
  TO authenticated
  WITH CHECK (
    signer_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM property_inventories
      WHERE property_inventories.id = inventory_signatures.inventory_id
        AND (property_inventories.landlord_id = auth.uid() OR property_inventories.tenant_id = auth.uid())
    )
  );

-- Fix send_system_message to bypass RLS
ALTER FUNCTION send_system_message(uuid, text, text) SECURITY DEFINER;
ALTER FUNCTION auto_send_payment_message() SECURITY DEFINER;
ALTER FUNCTION notify_booking_status_change() SECURITY DEFINER;

-- Fix calculate_prorated_payment() function
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
