/*
  # Ajout du type d'utilisateur aux fonctionnalités

  1. Modifications
    - Ajout de la colonne `user_type` à la table `feature_carousel_images`
    - Valeurs possibles: 'student', 'landlord', 'both'
    - Valeur par défaut: 'both' (visible pour tous)
  
  2. Notes
    - Les fonctionnalités existantes seront définies comme 'both' par défaut
    - Permet de filtrer les fonctionnalités par type d'utilisateur sur la page Features
*/

-- Ajouter la colonne user_type avec une contrainte de validation
ALTER TABLE feature_carousel_images 
ADD COLUMN IF NOT EXISTS user_type text DEFAULT 'both' CHECK (user_type IN ('student', 'landlord', 'both'));

-- Créer un index pour améliorer les performances de filtrage
CREATE INDEX IF NOT EXISTS idx_feature_carousel_user_type 
ON feature_carousel_images(user_type) 
WHERE is_active = true;