/*
  # Ajout de l'accès admin aux documents

  1. Modifications
    - Suppression et recréation de la politique de lecture des documents
    - Ajout de la possibilité pour les admins de voir tous les documents
    
  2. Sécurité
    - Les utilisateurs peuvent toujours voir leurs propres documents
    - Les administrateurs (role = 'admin') peuvent voir tous les documents pour vérification
*/

-- Supprimer l'ancienne politique de lecture
DROP POLICY IF EXISTS "Utilisateurs peuvent voir leurs propres documents" ON storage.objects;

-- Créer une nouvelle politique qui permet aux utilisateurs de voir leurs propres documents
-- ET aux admins de voir tous les documents
CREATE POLICY "Utilisateurs et admins peuvent voir les documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents' AND (
      auth.uid()::text = (storage.foldername(name))[1] OR
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  );