/*
  # Add GPS coordinates to listings

  1. Changes
    - Add `latitude` column to listings table (decimal type)
    - Add `longitude` column to listings table (decimal type)
    - Set default values for existing listings to Fontainebleau center
  
  2. Notes
    - Coordinates will be used to display listings on the interactive map
    - Latitude and longitude are optional fields
    - Default coordinates point to Fontainebleau center (48.4084, 2.7007)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE listings ADD COLUMN latitude decimal(10, 8) DEFAULT 48.4084;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE listings ADD COLUMN longitude decimal(11, 8) DEFAULT 2.7007;
  END IF;
END $$;
