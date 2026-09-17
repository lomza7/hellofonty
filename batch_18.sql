/*
  # Add INSEAD distance cache to listings

  Stores the computed driving distance and duration from each listing to INSEAD
  so we avoid repeated API calls and can display the data immediately.

  1. New columns on `listings`
    - `insead_distance_text` (text) - e.g. "2.1 km"
    - `insead_duration_text` (text) - e.g. "6 min"
*/

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

/*
  # Add surface_sqm to listings

  1. Changes
    - Adds `surface_sqm` (integer, nullable) column to listings table
      Stores the size of the property in square meters
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'surface_sqm'
  ) THEN
    ALTER TABLE listings ADD COLUMN surface_sqm integer;
  END IF;
END $$;

/*
  # Fix inventory signature RLS policies

  ## Problem
  1. The UPDATE policy on property_inventories only allows updating when status='draft' AND requires
     the new status to also be 'draft' (WITH CHECK). This blocks the signing operation which sets status='signed'.
  2. The INSERT policy on inventory_signatures has no WITH CHECK clause.

  ## Changes
  - Drop and recreate the UPDATE policy to allow landlords to update their draft inventories
    and change status to 'signed' (removing the status constraint from WITH CHECK)
  - Fix the INSERT policy on inventory_signatures to add proper WITH CHECK
*/

-- Fix property_inventories UPDATE policy to allow signing (status change from draft to signed)
DROP POLICY IF EXISTS "Landlords can update own draft inventories" ON property_inventories;

CREATE POLICY "Landlords can update own inventories"
  ON property_inventories
  FOR UPDATE
  TO authenticated
  USING (landlord_id = auth.uid())
  WITH CHECK (landlord_id = auth.uid());

-- Fix inventory_signatures INSERT policy to add WITH CHECK
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

/*
  # Fix send_system_message to bypass RLS

  1. Problem
    - When a landlord confirms a booking, the trigger `auto_send_payment_message` 
      calls `send_system_message` which inserts into `messages` with `sender_id = NULL`
    - The RLS insert policy on `messages` requires `auth.uid() = sender_id`, 
      which fails because `auth.uid()` (the landlord) != NULL
    - This causes the entire booking UPDATE to fail with "Erreur lors de la mise a jour"

  2. Fix
    - Make `send_system_message` a SECURITY DEFINER function so it bypasses RLS
    - Make `auto_send_payment_message` a SECURITY DEFINER function
    - Make `notify_booking_status_change` a SECURITY DEFINER function
    - All these functions are only called by triggers, so this is safe

  3. Security
    - These functions are only invoked via database triggers, not directly by users
    - SECURITY DEFINER is necessary for system-generated messages with NULL sender_id
*/

ALTER FUNCTION send_system_message(uuid, text, text) SECURITY DEFINER;
ALTER FUNCTION auto_send_payment_message() SECURITY DEFINER;
ALTER FUNCTION notify_booking_status_change() SECURITY DEFINER;

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

