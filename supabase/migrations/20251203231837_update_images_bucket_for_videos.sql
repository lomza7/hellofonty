/*
  # Mise à jour du bucket images pour supporter les vidéos

  1. Modifications
    - Ajoute les types MIME vidéo au bucket 'images' existant
    - Augmente la limite de taille pour supporter les vidéos (100 MB)
    - Les vidéos supportées : mp4, webm, mov, avi

  2. Sécurité
    - Les politiques existantes restent inchangées
    - Les utilisateurs authentifiés peuvent uploader des vidéos
    - Les vidéos sont publiques comme les images
*/

-- Mettre à jour le bucket images pour accepter les vidéos et augmenter la taille
UPDATE storage.buckets
SET 
  allowed_mime_types = ARRAY[
    'image/jpeg', 
    'image/png', 
    'image/webp', 
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo'
  ],
  file_size_limit = 104857600
WHERE id = 'images';