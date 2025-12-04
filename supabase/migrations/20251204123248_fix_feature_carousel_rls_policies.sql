/*
  # Fix Feature Carousel RLS Policies

  1. Changes
    - Drop existing SELECT policies that prevent admins from viewing inactive features
    - Create new SELECT policy that allows:
      - Anyone to view active features
      - Admins to view all features (active and inactive)
  
  2. Security
    - Public users can only see active features
    - Admins can see all features for management purposes
*/

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Anyone can view active features" ON feature_carousel_images;
DROP POLICY IF EXISTS "Admins can view all features" ON feature_carousel_images;

-- Create combined SELECT policy
CREATE POLICY "Public views active, admins view all"
  ON feature_carousel_images
  FOR SELECT
  USING (
    is_active = true 
    OR 
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
