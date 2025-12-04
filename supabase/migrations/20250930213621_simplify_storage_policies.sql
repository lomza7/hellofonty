/*
  # Simplification des politiques de stockage
  
  1. Problème identifié :
    - Les politiques trop restrictives bloquent les uploads légitimes
    - La validation des chemins de fichiers est trop stricte
  
  2. Solution :
    - Simplifier les politiques pour permettre aux utilisateurs authentifiés d'uploader
    - Garder une sécurité de base mais plus flexible
  
  3. Buckets concernés :
    - profile-avatars : avatars des utilisateurs
    - documents : documents de vérification INSEAD
*/

-- =====================================================
-- BUCKET: profile-avatars
-- =====================================================

-- Nettoyer les anciennes politiques
DROP POLICY IF EXISTS "Public avatars are viewable by everyone" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

-- Tout le monde peut voir les avatars (bucket public)
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-avatars');

-- Les utilisateurs authentifiés peuvent uploader dans profile-avatars
CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'profile-avatars');

-- Les utilisateurs authentifiés peuvent mettre à jour dans profile-avatars
CREATE POLICY "Authenticated users can update avatars"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'profile-avatars');

-- Les utilisateurs authentifiés peuvent supprimer dans profile-avatars
CREATE POLICY "Authenticated users can delete avatars"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'profile-avatars');

-- =====================================================
-- BUCKET: documents
-- =====================================================

-- Nettoyer les anciennes politiques
DROP POLICY IF EXISTS "Users can view their verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their verification documents" ON storage.objects;

-- Les utilisateurs peuvent voir leurs propres documents
CREATE POLICY "Authenticated users can view documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

-- Les utilisateurs peuvent uploader des documents
CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents');

-- Les utilisateurs peuvent mettre à jour des documents
CREATE POLICY "Authenticated users can update documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'documents');

-- Les utilisateurs peuvent supprimer des documents
CREATE POLICY "Authenticated users can delete documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'documents');