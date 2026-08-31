-- Phase 2: Create public_profiles view with only safe columns
-- The profiles table currently exposes ALL columns (including stripe_*, verification_*) 
-- to everyone via the "Profils lisibles publiquement pour les statistiques" policy.
-- This view exposes only the columns needed for public display.

CREATE OR REPLACE VIEW public_profiles AS
SELECT 
  id,
  first_name,
  last_name,
  avatar_url,
  role,
  is_verified,
  created_at
FROM profiles;

-- The view inherits RLS from the underlying table, but since it's a view,
-- we can grant SELECT on it to anon and authenticated
GRANT SELECT ON public_profiles TO anon, authenticated;

-- Drop the permissive public SELECT policies on profiles
DROP POLICY IF EXISTS "Profils lisibles publiquement pour les statistiques" ON profiles;
DROP POLICY IF EXISTS "Profils visibles publiquement pour statistiques" ON profiles;

-- Revoke SELECT from anon on profiles (they should use public_profiles view)
REVOKE SELECT ON profiles FROM anon;

-- Keep SELECT on profiles for authenticated (they need full profile data for messaging, etc.)
-- But add a policy: authenticated users can view profiles of:
-- 1. Themselves
-- 2. Landlords whose listings they've booked (as students)
-- 3. Students who booked their listings (as landlords)
-- 4. Admins (all profiles)
-- 5. Users they share a conversation with

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

CREATE POLICY "Landlords can view profiles of students who booked their listings" ON profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE l.landlord_id = auth.uid() AND b.student_id = profiles.id
    )
  );

CREATE POLICY "Students can view profiles of landlords whose listings they booked" ON profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE b.student_id = auth.uid() AND l.landlord_id = profiles.id
    )
  );

CREATE POLICY "Users can view profiles of conversation partners" ON profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      WHERE (m.sender_id = auth.uid() AND m.recipient_id = profiles.id)
         OR (m.recipient_id = auth.uid() AND m.sender_id = profiles.id)
    )
  );
