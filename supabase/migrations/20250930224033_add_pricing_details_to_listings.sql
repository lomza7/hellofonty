/*
  # Ajout des détails de tarification pour les annonces

  ## Nouvelles colonnes
  Cette migration ajoute des colonnes détaillées pour la tarification transparente :

  ### Loyer et charges
    - `base_rent` (numeric) - Loyer de base mensuel hors charges
    - `electricity_cost` (numeric) - Coût mensuel de l'électricité
    - `heating_cost` (numeric) - Coût mensuel du chauffage
    - `water_cost` (numeric) - Coût mensuel de l'eau
    - `custom_charges` (jsonb) - Autres charges personnalisées avec nom et montant

  ## Notes importantes
  - La colonne `price_per_month` existante contiendra le total (loyer + toutes les charges)
  - Ces colonnes permettent une transparence totale sur les coûts
  - Les étudiants peuvent voir exactement ce qu'ils paieront
  - Toutes les colonnes sont optionnelles pour ne pas bloquer les annonces existantes
*/

DO $$
BEGIN
  -- Colonnes de tarification
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'base_rent'
  ) THEN
    ALTER TABLE listings ADD COLUMN base_rent numeric(10, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'electricity_cost'
  ) THEN
    ALTER TABLE listings ADD COLUMN electricity_cost numeric(10, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'heating_cost'
  ) THEN
    ALTER TABLE listings ADD COLUMN heating_cost numeric(10, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'water_cost'
  ) THEN
    ALTER TABLE listings ADD COLUMN water_cost numeric(10, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'custom_charges'
  ) THEN
    ALTER TABLE listings ADD COLUMN custom_charges jsonb;
  END IF;
END $$;

-- Ajouter des contraintes pour la validation des données
ALTER TABLE listings 
  DROP CONSTRAINT IF EXISTS check_base_rent_positive;

ALTER TABLE listings 
  ADD CONSTRAINT check_base_rent_positive 
  CHECK (base_rent IS NULL OR base_rent >= 0);

ALTER TABLE listings 
  DROP CONSTRAINT IF EXISTS check_electricity_cost_positive;

ALTER TABLE listings 
  ADD CONSTRAINT check_electricity_cost_positive 
  CHECK (electricity_cost IS NULL OR electricity_cost >= 0);

ALTER TABLE listings 
  DROP CONSTRAINT IF EXISTS check_heating_cost_positive;

ALTER TABLE listings 
  ADD CONSTRAINT check_heating_cost_positive 
  CHECK (heating_cost IS NULL OR heating_cost >= 0);

ALTER TABLE listings 
  DROP CONSTRAINT IF EXISTS check_water_cost_positive;

ALTER TABLE listings 
  ADD CONSTRAINT check_water_cost_positive 
  CHECK (water_cost IS NULL OR water_cost >= 0);