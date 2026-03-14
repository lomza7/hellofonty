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
