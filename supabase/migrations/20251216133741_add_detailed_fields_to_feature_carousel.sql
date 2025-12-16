/*
  # Ajouter des champs détaillés à feature_carousel_images

  1. Modifications
    - Ajouter `detailed_title_fr` (text) - Titre détaillé en français
    - Ajouter `detailed_title_en` (text) - Titre détaillé en anglais
    - Ajouter `detailed_description_fr` (text) - Description détaillée en français
    - Ajouter `detailed_description_en` (text) - Description détaillée en anglais
    - Ajouter `features` (jsonb) - Liste de caractéristiques avec icônes (format: [{icon, text_fr, text_en}])
    - Ajouter `video_url` (text) - URL de la vidéo
    - Ajouter `cta_text_fr` (text) - Texte du bouton CTA en français
    - Ajouter `cta_text_en` (text) - Texte du bouton CTA en anglais
    - Ajouter `cta_url` (text) - URL du bouton CTA

  2. Notes
    - Ces champs sont optionnels et permettent de créer une page de fonctionnalités détaillées
    - Le champ `features` stocke un tableau JSON avec des objets {icon, text_fr, text_en}
    - Les colonnes existantes restent inchangées pour le carousel
*/

DO $$
BEGIN
  -- Ajouter les titres détaillés
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_carousel_images' AND column_name = 'detailed_title_fr'
  ) THEN
    ALTER TABLE feature_carousel_images ADD COLUMN detailed_title_fr text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_carousel_images' AND column_name = 'detailed_title_en'
  ) THEN
    ALTER TABLE feature_carousel_images ADD COLUMN detailed_title_en text;
  END IF;

  -- Ajouter les descriptions détaillées
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_carousel_images' AND column_name = 'detailed_description_fr'
  ) THEN
    ALTER TABLE feature_carousel_images ADD COLUMN detailed_description_fr text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_carousel_images' AND column_name = 'detailed_description_en'
  ) THEN
    ALTER TABLE feature_carousel_images ADD COLUMN detailed_description_en text;
  END IF;

  -- Ajouter le champ features (jsonb)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_carousel_images' AND column_name = 'features'
  ) THEN
    ALTER TABLE feature_carousel_images ADD COLUMN features jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Ajouter l'URL de la vidéo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_carousel_images' AND column_name = 'video_url'
  ) THEN
    ALTER TABLE feature_carousel_images ADD COLUMN video_url text;
  END IF;

  -- Ajouter les champs CTA
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_carousel_images' AND column_name = 'cta_text_fr'
  ) THEN
    ALTER TABLE feature_carousel_images ADD COLUMN cta_text_fr text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_carousel_images' AND column_name = 'cta_text_en'
  ) THEN
    ALTER TABLE feature_carousel_images ADD COLUMN cta_text_en text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_carousel_images' AND column_name = 'cta_url'
  ) THEN
    ALTER TABLE feature_carousel_images ADD COLUMN cta_url text;
  END IF;
END $$;