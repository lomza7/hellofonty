/*
  # Fix anon SELECT policies blocked by is_admin()

  1. Problem
     - feature_carousel_images SELECT policy is scoped to `public` and calls is_admin().
     - listings SELECT policy "Annonces actives visibles publiquement" is scoped to `public` and calls is_admin().
     - anon does NOT have EXECUTE on is_admin(), so every anon request fails with
       "permission denied for function is_admin".

  2. Changes
     - feature_carousel_images: drop the `public` SELECT policy, create two separate policies:
       * anon: SELECT where is_active = true (no is_admin call)
       * authenticated: SELECT where is_active = true OR is_admin()
     - listings: drop the `public` SELECT policy, create two separate policies:
       * anon: SELECT where is_active = true (no is_admin call)
       * authenticated: SELECT where is_active = true OR landlord_id = auth.uid() OR is_admin()

  3. Security
     - anon can only read active (publicly visible) rows — same as before, minus the broken is_admin call.
     - authenticated users keep the same access: active rows, own rows, plus admin sees everything.
*/

-- feature_carousel_images
DROP POLICY IF EXISTS "Public views active, admins view all" ON feature_carousel_images;

CREATE POLICY "anon_select_active_features"
  ON feature_carousel_images FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "auth_select_features"
  ON feature_carousel_images FOR SELECT
  TO authenticated
  USING (is_active = true OR is_admin());

-- listings
DROP POLICY IF EXISTS "Annonces actives visibles publiquement" ON listings;

CREATE POLICY "anon_select_active_listings"
  ON listings FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "auth_select_listings"
  ON listings FOR SELECT
  TO authenticated
  USING (is_active = true OR landlord_id = auth.uid() OR is_admin());
