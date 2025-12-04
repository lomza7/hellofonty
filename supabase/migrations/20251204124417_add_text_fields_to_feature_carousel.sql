/*
  # Ajout des champs de texte aux carrousels de fonctionnalités

  1. Modifications
    - Ajout de colonnes pour le titre et la description en français et anglais
    - `title_fr` (text) - Titre en français
    - `title_en` (text) - Titre en anglais
    - `description_fr` (text) - Description en français
    - `description_en` (text) - Description en anglais
  
  2. Notes
    - Ces champs sont optionnels pour permettre une transition en douceur
    - Si non renseignés, l'application utilisera les textes hardcodés par défaut
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_carousel_images' AND column_name = 'title_fr'
  ) THEN
    ALTER TABLE feature_carousel_images ADD COLUMN title_fr text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_carousel_images' AND column_name = 'title_en'
  ) THEN
    ALTER TABLE feature_carousel_images ADD COLUMN title_en text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_carousel_images' AND column_name = 'description_fr'
  ) THEN
    ALTER TABLE feature_carousel_images ADD COLUMN description_fr text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_carousel_images' AND column_name = 'description_en'
  ) THEN
    ALTER TABLE feature_carousel_images ADD COLUMN description_en text;
  END IF;
END $$;