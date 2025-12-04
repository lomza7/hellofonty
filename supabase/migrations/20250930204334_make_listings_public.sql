/*
  # Rendre les annonces publiques

  1. Modifications de sécurité
    - Supprimer les politiques existantes pour SELECT sur `listings` et `listing_images`
    - Créer de nouvelles politiques permettant l'accès public (anon + authenticated)
    - Les annonces actives sont visibles par tous les visiteurs
    - Les images des annonces sont visibles par tous les visiteurs
  
  2. Notes importantes
    - Les propriétaires conservent le contrôle total (création, modification, suppression)
    - Seule la lecture est rendue publique
    - Améliore l'expérience utilisateur en permettant de voir les annonces avant l'inscription
*/

-- Supprimer les politiques SELECT existantes pour listings
DROP POLICY IF EXISTS "Annonces visibles par tous les utilisateurs authentifiés" ON listings;

-- Supprimer les politiques SELECT existantes pour listing_images
DROP POLICY IF EXISTS "Images visibles par tous les utilisateurs authentifiés" ON listing_images;

-- Créer une nouvelle politique publique pour voir les annonces actives
CREATE POLICY "Annonces actives visibles publiquement"
  ON listings
  FOR SELECT
  TO public
  USING (is_active = true OR landlord_id = auth.uid());

-- Créer une nouvelle politique publique pour voir les images des annonces
CREATE POLICY "Images des annonces visibles publiquement"
  ON listing_images
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_images.listing_id
      AND listings.is_active = true
    )
  );
