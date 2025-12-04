/*
  # Add House Rules to Listings

  1. Changes
    - Add house rules columns to listings table:
      - `check_in_start` (text) - Check-in start time (e.g., "14:00")
      - `check_in_end` (text) - Check-in end time (e.g., "22:00")
      - `check_out_time` (text) - Check-out time (e.g., "11:00")
      - `pets_allowed` (boolean) - Whether pets are allowed
      - `smoking_allowed` (boolean) - Whether smoking is allowed
      - `quiet_hours_start` (text) - Quiet hours start time (e.g., "22:00")
      - `quiet_hours_end` (text) - Quiet hours end time (e.g., "08:00")
      - `additional_rules` (text) - Additional custom rules
      - `parties_allowed` (boolean) - Whether parties/events are allowed
      - `children_allowed` (boolean) - Whether children are allowed

  2. Notes
    - All fields are optional with sensible defaults
    - Times are stored as text in 24-hour format (HH:MM)
    - Boolean fields default to true/false based on common preferences
*/

-- Add house rules columns to listings table
DO $$
BEGIN
  -- Check-in and check-out times
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'check_in_start'
  ) THEN
    ALTER TABLE listings ADD COLUMN check_in_start text DEFAULT '14:00';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'check_in_end'
  ) THEN
    ALTER TABLE listings ADD COLUMN check_in_end text DEFAULT '22:00';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'check_out_time'
  ) THEN
    ALTER TABLE listings ADD COLUMN check_out_time text DEFAULT '11:00';
  END IF;

  -- Rules about pets, smoking, parties, children
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'pets_allowed'
  ) THEN
    ALTER TABLE listings ADD COLUMN pets_allowed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'smoking_allowed'
  ) THEN
    ALTER TABLE listings ADD COLUMN smoking_allowed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'parties_allowed'
  ) THEN
    ALTER TABLE listings ADD COLUMN parties_allowed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'children_allowed'
  ) THEN
    ALTER TABLE listings ADD COLUMN children_allowed boolean DEFAULT true;
  END IF;

  -- Quiet hours
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'quiet_hours_start'
  ) THEN
    ALTER TABLE listings ADD COLUMN quiet_hours_start text DEFAULT '22:00';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'quiet_hours_end'
  ) THEN
    ALTER TABLE listings ADD COLUMN quiet_hours_end text DEFAULT '08:00';
  END IF;

  -- Additional custom rules
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'additional_rules'
  ) THEN
    ALTER TABLE listings ADD COLUMN additional_rules text;
  END IF;
END $$;