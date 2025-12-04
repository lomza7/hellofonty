/*
  # Remove phone verification system

  1. Changes
    - Remove phone_verified column from profiles table
    - Remove phone_verification_codes table
    - Remove phone_verification_attempts table
    
  2. Notes
    - This migration removes the phone verification system
    - The system will now use email verification only (built-in Supabase auth)
*/

-- Remove phone_verified column from profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone_verified'
  ) THEN
    ALTER TABLE profiles DROP COLUMN phone_verified;
  END IF;
END $$;

-- Drop phone_verification_codes table if exists
DROP TABLE IF EXISTS phone_verification_codes CASCADE;

-- Drop phone_verification_attempts table if exists
DROP TABLE IF EXISTS phone_verification_attempts CASCADE;
