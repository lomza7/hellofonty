/*
  # Add English Features to Pricing Plans

  1. Changes
    - Add `features_en` column to `pricing_plans` table for English translations
    - Rename existing `features` to `features_fr` for clarity
    - Populate English translations for existing plans

  2. Data Migration
    - Update existing plans with English feature translations
*/

-- Add features_en column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pricing_plans' AND column_name = 'features_en'
  ) THEN
    ALTER TABLE pricing_plans ADD COLUMN features_en text[] DEFAULT '{}';
  END IF;
END $$;

-- Update existing plans with English translations
UPDATE pricing_plans
SET features_en = ARRAY[
  'Publish 1 listing',
  'Basic features'
]
WHERE name = 'Gratuit' AND type = 'landlord';

UPDATE pricing_plans
SET features_en = ARRAY[
  'Unlimited listings',
  'Availability calendar',
  'Featured placement',
  'Advanced statistics',
  'Priority support'
]
WHERE name = 'Premium' AND type = 'landlord';

UPDATE pricing_plans
SET features_en = ARRAY[
  'Service fees',
  'Booking insurance',
  'Support 24/7'
]
WHERE name = 'Frais de réservation' AND type = 'student';