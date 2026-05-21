/*
  # Fix listing_images RLS: add UPDATE policy and admin access

  1. Problem
    - No UPDATE policy exists on listing_images, so reordering photos (changing display_order) is silently blocked by RLS
    - No admin policies exist, so admin users cannot manage listing images

  2. Changes
    - Add UPDATE policy for landlords to update their own listing images
    - Add SELECT, INSERT, UPDATE, DELETE policies for admin users
    - Landlords who own the listing can also read their own inactive listing images
*/

-- Landlords can update their own listing images (for reordering)
CREATE POLICY "Proprietaires peuvent modifier les images de leurs annonces"
  ON listing_images
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_images.listing_id
      AND listings.landlord_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_images.listing_id
      AND listings.landlord_id = auth.uid()
    )
  );

-- Landlords can view images of their own listings (even inactive)
CREATE POLICY "Proprietaires peuvent voir les images de leurs annonces"
  ON listing_images
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_images.listing_id
      AND listings.landlord_id = auth.uid()
    )
  );

-- Admin: SELECT
CREATE POLICY "Admins peuvent voir toutes les images"
  ON listing_images
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin: INSERT
CREATE POLICY "Admins peuvent ajouter des images"
  ON listing_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin: UPDATE
CREATE POLICY "Admins peuvent modifier toutes les images"
  ON listing_images
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin: DELETE
CREATE POLICY "Admins peuvent supprimer toutes les images"
  ON listing_images
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );