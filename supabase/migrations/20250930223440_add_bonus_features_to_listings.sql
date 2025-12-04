/*
  # Ajout de la section Bonus pour les annonces

  ## Nouvelle colonne
  Cette migration ajoute une colonne pour les équipements premium et bonus :

  ### Équipements Bonus
    - `bonus_features` (text[]) - Liste des équipements premium disponibles
      Exemples : Fibre optique, Netflix, Disney+, Vélo, Console de jeux, etc.

  ## Notes importantes
  - Cette colonne est optionnelle pour ne pas bloquer les annonces existantes
  - Ces équipements "bonus" permettent aux propriétaires de se démarquer
  - Les étudiants peuvent facilement identifier les logements avec des avantages supplémentaires
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'bonus_features'
  ) THEN
    ALTER TABLE listings ADD COLUMN bonus_features text[];
  END IF;
END $$;