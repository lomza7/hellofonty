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
