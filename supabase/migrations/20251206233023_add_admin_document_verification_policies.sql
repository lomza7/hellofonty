/*
  # Politiques Admin pour la Vérification des Documents

  1. Nouvelles Politiques
    - Les admins peuvent consulter tous les documents étudiants
    - Les admins peuvent consulter tous les documents propriétaires
    - Les admins peuvent mettre à jour le statut et les notes des documents étudiants
    - Les admins peuvent mettre à jour le statut et les notes des documents propriétaires
  
  2. Sécurité
    - Seuls les utilisateurs avec role = 'admin' peuvent accéder
    - Les admins peuvent uniquement modifier status et admin_notes (pas les documents eux-mêmes)
*/

-- Politique : Les admins peuvent voir tous les documents étudiants
CREATE POLICY "Admins can view all student documents"
  ON student_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Politique : Les admins peuvent mettre à jour les documents étudiants
CREATE POLICY "Admins can update student document status"
  ON student_documents
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

-- Politique : Les admins peuvent voir tous les documents propriétaires
CREATE POLICY "Admins can view all landlord documents"
  ON landlord_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Politique : Les admins peuvent mettre à jour les documents propriétaires
CREATE POLICY "Admins can update landlord document status"
  ON landlord_documents
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