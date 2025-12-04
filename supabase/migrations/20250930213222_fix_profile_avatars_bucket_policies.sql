/*
  # Correction des politiques RLS pour le bucket profile-avatars
  
  1. Corrections apportées :
    - Supprimer les anciennes politiques
    - Recréer les politiques avec la bonne syntaxe
    - Utiliser auth.uid() pour les chemins des fichiers
  
  2. Notes importantes :
    - Les fichiers sont stockés dans un dossier par utilisateur : {user_id}/avatar.{ext}
    - Seul le propriétaire peut uploader/modifier son avatar
*/

-- Supprimer toutes les politiques existantes pour profile-avatars
DROP POLICY IF EXISTS "Avatars visibles par tous" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs peuvent uploader leur avatar" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs peuvent mettre à jour leur avatar" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs peuvent supprimer leur avatar" ON storage.objects;

-- Politique : Tout le monde peut voir les avatars publics
CREATE POLICY "Public avatars are viewable by everyone"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-avatars');

-- Politique : Les utilisateurs authentifiés peuvent uploader leur propre avatar
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Politique : Les utilisateurs peuvent mettre à jour leur propre avatar
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Politique : Les utilisateurs peuvent supprimer leur propre avatar
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );