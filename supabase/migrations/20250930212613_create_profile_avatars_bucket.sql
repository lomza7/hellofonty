/*
  # Création du bucket de stockage pour les photos de profil
  
  1. Bucket de stockage :
    - Nom : 'profile-avatars'
    - Public : true (les avatars sont visibles par tous)
    - Taille maximale : 2MB
    - Types de fichiers : images uniquement
  
  2. Politiques de sécurité :
    - Tout le monde peut voir les avatars
    - Seul le propriétaire peut uploader/modifier son avatar
    - Seul le propriétaire peut supprimer son avatar
*/

-- Créer le bucket pour les avatars de profil
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-avatars',
  'profile-avatars',
  true,
  2097152, -- 2MB en bytes
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Avatars visibles par tous" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs peuvent uploader leur avatar" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs peuvent mettre à jour leur avatar" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs peuvent supprimer leur avatar" ON storage.objects;

-- Politique : Tout le monde peut voir les avatars
CREATE POLICY "Avatars visibles par tous"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'profile-avatars');

-- Politique : Les utilisateurs peuvent uploader leur propre avatar
CREATE POLICY "Utilisateurs peuvent uploader leur avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Politique : Les utilisateurs peuvent mettre à jour leur propre avatar
CREATE POLICY "Utilisateurs peuvent mettre à jour leur avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profile-avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Politique : Les utilisateurs peuvent supprimer leur propre avatar
CREATE POLICY "Utilisateurs peuvent supprimer leur avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );