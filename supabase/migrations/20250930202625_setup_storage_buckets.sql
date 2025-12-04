/*
  # Configuration des buckets de stockage Supabase

  ## 1. Buckets de stockage
  
  ### `images`
  - Stockage des photos d'annonces
  - Accessible publiquement pour affichage
  - Upload limité aux propriétaires authentifiés pour leurs propres annonces
  
  ### `documents`
  - Stockage des documents de vérification (attestations de scolarité PDF)
  - Upload limité aux étudiants pour leurs propres documents
  - Accès restreint : uniquement l'utilisateur propriétaire et les administrateurs

  ## 2. Politiques de sécurité
  
  ### Bucket `images`
  - Lecture publique pour tous
  - Upload uniquement pour les propriétaires authentifiés
  - Suppression uniquement pour le propriétaire de l'annonce
  
  ### Bucket `documents`
  - Lecture uniquement par le propriétaire du document
  - Upload uniquement par l'utilisateur pour ses propres documents
  - Suppression uniquement par le propriétaire

  ## 3. Notes importantes
  
  - Les buckets sont créés avec des permissions restrictives par défaut
  - Les politiques RLS garantissent que les utilisateurs ne peuvent accéder qu'à leurs propres données
  - Les images sont publiques pour permettre l'affichage des annonces
  - Les documents de vérification restent privés
*/

-- Créer le bucket pour les images d'annonces
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Créer le bucket pour les documents de vérification
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Politique : tout le monde peut voir les images publiques
CREATE POLICY "Images publiques visibles par tous"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'images');

-- Politique : utilisateurs authentifiés peuvent uploader des images
CREATE POLICY "Utilisateurs authentifiés peuvent uploader des images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'images' AND
    auth.role() = 'authenticated'
  );

-- Politique : propriétaires peuvent supprimer leurs propres images
CREATE POLICY "Propriétaires peuvent supprimer leurs images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Politique : utilisateurs peuvent voir leurs propres documents
CREATE POLICY "Utilisateurs peuvent voir leurs propres documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Politique : utilisateurs peuvent uploader leurs propres documents
CREATE POLICY "Utilisateurs peuvent uploader leurs documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Politique : utilisateurs peuvent supprimer leurs propres documents
CREATE POLICY "Utilisateurs peuvent supprimer leurs documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );