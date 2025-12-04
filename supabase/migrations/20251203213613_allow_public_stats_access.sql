/*
  # Permettre l'accès public aux statistiques

  1. Modifications
    - Ajouter une politique pour permettre aux utilisateurs anonymes de lire les profils (pour compter)
    - Ajouter une politique pour permettre aux utilisateurs anonymes de voir les listings actifs
  
  2. Sécurité
    - Les utilisateurs anonymes peuvent seulement lire les données, pas les modifier
    - Les listings inactifs restent cachés pour les utilisateurs anonymes
*/

-- Politique pour permettre aux utilisateurs anonymes de lire les profils (pour les stats)
CREATE POLICY "Profils lisibles publiquement pour les statistiques"
  ON profiles FOR SELECT
  TO anon
  USING (true);

-- Politique pour permettre aux utilisateurs anonymes de voir les listings actifs
CREATE POLICY "Listings actifs visibles publiquement"
  ON listings FOR SELECT
  TO anon
  USING (is_active = true);