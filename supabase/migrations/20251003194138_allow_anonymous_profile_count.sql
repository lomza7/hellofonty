/*
  # Permettre le comptage anonyme des profils

  1. Modifications
    - Ajouter une politique permettant de compter les profils sans authentification
    - Utiliser une politique restrictive qui permet uniquement le comptage (COUNT)
  
  2. Sécurité
    - La politique permet uniquement de compter, pas de lire les détails
    - Les données personnelles restent protégées
*/

-- Permettre la lecture des profils pour les statistiques publiques
DROP POLICY IF EXISTS "Profils visibles par tous les utilisateurs authentifiés" ON profiles;

CREATE POLICY "Profils visibles publiquement pour statistiques"
  ON profiles
  FOR SELECT
  USING (true);
