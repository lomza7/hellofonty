/*
  # Add Admin Role to Profiles

  1. Changes
    - Modify the `role` column check constraint to include 'admin'
    - Profiles can now have role: 'student', 'landlord', or 'admin'
  
  2. Security
    - No RLS changes needed as admins inherit from existing policies
    - Admin access will be controlled at the application level
*/

-- Drop the existing check constraint
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'profiles_role_check'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
  END IF;
END $$;

-- Add the new check constraint with admin role
ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role = ANY (ARRAY['student'::text, 'landlord'::text, 'admin'::text]));