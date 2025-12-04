/*
  # Add Minimum Stay to Listings

  1. Changes
    - Add `minimum_stay` column to listings table
      - Type: integer
      - Default: 1 (1 month minimum)
      - Represents the minimum duration in months for a rental

  2. Notes
    - This field helps landlords set their minimum rental period
    - Default value of 1 month is suitable for student housing
    - Value represents number of months
*/

-- Add minimum_stay column to listings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'minimum_stay'
  ) THEN
    ALTER TABLE listings ADD COLUMN minimum_stay integer DEFAULT 1;
  END IF;
END $$;