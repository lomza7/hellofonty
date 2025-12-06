/*
  # Correction de l'accès admin aux buckets de documents

  1. Modifications
    - Ajout de politiques pour permettre aux admins de voir les documents des étudiants
    - Ajout de politiques pour permettre aux admins de voir les documents des propriétaires
    
  2. Sécurité
    - Les utilisateurs peuvent toujours voir leurs propres documents
    - Les administrateurs (role = 'admin') peuvent voir tous les documents pour vérification
*/

-- Politique pour que les admins puissent voir les documents étudiants
CREATE POLICY "Admins peuvent voir tous les documents étudiants"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'student-documents' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Politique pour que les admins puissent voir les documents propriétaires
CREATE POLICY "Admins peuvent voir tous les documents propriétaires"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'landlord-documents' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );