/*
  # Permettre aux admins de voir tous les messages

  1. Modifications
    - Ajoute une politique permettant aux utilisateurs avec le rôle 'admin' de voir tous les messages
    - Nécessaire pour la fonctionnalité de surveillance des conversations dans le panneau admin

  2. Sécurité
    - Seuls les utilisateurs avec role = 'admin' peuvent voir tous les messages
    - Les utilisateurs normaux peuvent toujours voir uniquement leurs propres messages (politique existante)
*/

-- Ajouter une politique pour permettre aux admins de voir tous les messages
CREATE POLICY "Admins peuvent voir tous les messages"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );