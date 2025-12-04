/*
  # Permettre aux admins de modifier les profils

  1. Modifications
    - Ajoute une politique permettant aux utilisateurs avec le rôle 'admin' de mettre à jour tous les profils
    - Nécessaire pour que les admins puissent approuver/rejeter les demandes de vérification

  2. Sécurité
    - Seuls les utilisateurs avec role = 'admin' peuvent modifier les profils des autres
    - Les utilisateurs normaux peuvent toujours modifier leur propre profil (politique existante)
*/

-- Ajouter une politique pour permettre aux admins de mettre à jour tous les profils
CREATE POLICY "Admins peuvent modifier tous les profils"
  ON profiles
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