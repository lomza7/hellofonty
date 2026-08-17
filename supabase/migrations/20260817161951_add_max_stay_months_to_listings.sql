/*
# Add max_stay_months column to listings

## Description
Ajoute une colonne `max_stay_months` a la table `listings` pour permettre
de definir la duree maximum de sejour autorisee pour chaque annonce.
La valeur par defaut est 6 mois.

## Nouvelle colonne
- `max_stay_months` (numeric, default 6) - Duree maximum de sejour en mois

## Notes
- La colonne est nullable pour compatibilite avec les annonces existantes.
- Les annonces existantes auront la valeur par defaut de 6 mois appliquee automatiquement.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'max_stay_months'
  ) THEN
    ALTER TABLE listings ADD COLUMN max_stay_months numeric DEFAULT 6;
  END IF;
END $$;