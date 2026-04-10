/*
  # Change minimum_stay column to support 2-week minimum

  1. Changes
    - Alter `minimum_stay` column type from integer to numeric(3,1)
      to support decimal values like 0.5 (representing 2 weeks)
    - Update default value to 0.5 (2 weeks)
  
  2. Notes
    - Value 0.5 = 2 weeks (14 days)
    - Value 1 = 1 month
    - Value 2+ = X months
    - Existing data (integer values) will be preserved as-is
*/

ALTER TABLE listings 
  ALTER COLUMN minimum_stay TYPE numeric(3,1) USING minimum_stay::numeric(3,1);

ALTER TABLE listings 
  ALTER COLUMN minimum_stay SET DEFAULT 0.5;
