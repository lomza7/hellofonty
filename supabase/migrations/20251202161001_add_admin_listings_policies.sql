/*
  # Ajouter des politiques admin pour les annonces

  1. Modifications de sécurité
    - Permettre aux admins de voir TOUTES les annonces (même inactives)
    - Permettre aux admins de modifier TOUTES les annonces
    - Permettre aux admins de supprimer TOUTES les annonces
  
  2. Notes importantes
    - Les admins ont un contrôle total sur toutes les annonces
    - Les propriétaires conservent leurs droits existants
    - Les utilisateurs normaux continuent de voir seulement les annonces actives
*/

-- Politique pour permettre aux admins de voir TOUTES les annonces
CREATE POLICY "Admins peuvent voir toutes les annonces"
  ON listings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Politique pour permettre aux admins de modifier TOUTES les annonces
CREATE POLICY "Admins peuvent modifier toutes les annonces"
  ON listings
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

-- Politique pour permettre aux admins de supprimer TOUTES les annonces
CREATE POLICY "Admins peuvent supprimer toutes les annonces"
  ON listings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
