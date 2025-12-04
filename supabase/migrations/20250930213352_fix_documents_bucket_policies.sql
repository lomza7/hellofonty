/*
  # Correction des politiques RLS pour le bucket documents
  
  1. Problème identifié :
    - Les politiques RLS attendaient un chemin de type {user_id}/document.pdf
    - Le code upload vers verification-documents/{user_id}-timestamp.pdf
  
  2. Corrections apportées :
    - Supprimer les anciennes politiques restrictives
    - Créer de nouvelles politiques qui permettent l'upload dans le dossier verification-documents
    - Vérifier que l'utilisateur authentifié est bien celui qui fait l'upload (via le nom du fichier qui contient son ID)
  
  3. Sécurité :
    - Le nom du fichier commence par l'ID de l'utilisateur
    - Seul le propriétaire peut voir son propre document
    - Seul le propriétaire peut supprimer son propre document
*/

-- Supprimer toutes les anciennes politiques pour le bucket documents
DROP POLICY IF EXISTS "Utilisateurs peuvent voir leurs propres documents" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs peuvent uploader leurs documents" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs peuvent supprimer leurs documents" ON storage.objects;

-- Politique : Utilisateurs peuvent voir leurs propres documents de vérification
CREATE POLICY "Users can view their verification documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = 'verification-documents' AND
    split_part((storage.filename(name)), '-', 1) = auth.uid()::text
  );

-- Politique : Utilisateurs peuvent uploader leurs propres documents de vérification
CREATE POLICY "Users can upload their verification documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = 'verification-documents' AND
    split_part((storage.filename(name)), '-', 1) = auth.uid()::text
  );

-- Politique : Utilisateurs peuvent supprimer leurs propres documents de vérification
CREATE POLICY "Users can delete their verification documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = 'verification-documents' AND
    split_part((storage.filename(name)), '-', 1) = auth.uid()::text
  );

-- Politique : Utilisateurs peuvent mettre à jour leurs propres documents
CREATE POLICY "Users can update their verification documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents' AND
    (storage.foldername(name))[1] = 'verification-documents' AND
    split_part((storage.filename(name)), '-', 1) = auth.uid()::text
  );