/*
  # Ajout de la tâche de vérification du numéro de téléphone

  1. Modifications
    - Mise à jour de la fonction `generate_profile_verification_tasks` pour ajouter la tâche téléphone
    - Ajout d'un trigger pour compléter automatiquement la tâche quand un téléphone est ajouté
    - Génération de la tâche pour tous les profils existants sans téléphone

  2. Comportement
    - La tâche "Ajouter votre numéro de téléphone" apparaît pour tous les utilisateurs sans téléphone
    - Elle se complète automatiquement dès qu'un numéro est ajouté dans le profil
    - Elle reste visible dans "Tâches à faire" tant que non complétée

  3. Sécurité
    - Utilise SECURITY DEFINER pour permettre les mises à jour automatiques
    - Vérifie les doublons avant création
*/

-- Mise à jour de la fonction generate_profile_verification_tasks pour inclure la tâche téléphone
CREATE OR REPLACE FUNCTION generate_profile_verification_tasks(profile_id uuid, user_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_exists boolean;
BEGIN
  -- Pour tous les utilisateurs : tâche photo de profil si pas de photo
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = profile_id AND avatar_url IS NOT NULL AND avatar_url != ''
  ) INTO task_exists;

  IF NOT task_exists THEN
    -- Vérifier si la tâche n'existe pas déjà
    IF NOT EXISTS (
      SELECT 1 FROM tasks
      WHERE user_id = profile_id
      AND title = 'Ajouter une photo de profil'
      AND status IN ('pending', 'completed')
    ) THEN
      INSERT INTO tasks (
        user_id,
        title,
        description,
        priority,
        status,
        task_type,
        related_entity_type
      ) VALUES (
        profile_id,
        'Ajouter une photo de profil',
        'Ajoutez une photo de profil pour compléter votre vérification. Rendez-vous dans votre profil.',
        'important',
        'pending',
        'system',
        'profile'
      );
    END IF;
  END IF;

  -- Pour tous les utilisateurs : tâche numéro de téléphone si pas de téléphone
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = profile_id AND phone IS NOT NULL AND phone != ''
  ) INTO task_exists;

  IF NOT task_exists THEN
    IF NOT EXISTS (
      SELECT 1 FROM tasks
      WHERE user_id = profile_id
      AND title = 'Ajouter votre numéro de téléphone'
      AND status IN ('pending', 'completed')
    ) THEN
      INSERT INTO tasks (
        user_id,
        title,
        description,
        priority,
        status,
        task_type,
        related_entity_type
      ) VALUES (
        profile_id,
        'Ajouter votre numéro de téléphone',
        'Ajoutez votre numéro de téléphone pour faciliter la communication avec les propriétaires/locataires.',
        'important',
        'pending',
        'system',
        'profile'
      );
    END IF;
  END IF;

  -- Tâches spécifiques pour les propriétaires
  IF user_role = 'landlord' THEN
    -- Tâche justificatif d'identité
    SELECT EXISTS (
      SELECT 1 FROM landlord_documents
      WHERE landlord_id = profile_id
      AND document_type = 'id_card'
      AND status = 'approved'
    ) INTO task_exists;

    IF NOT task_exists THEN
      IF NOT EXISTS (
        SELECT 1 FROM tasks
        WHERE user_id = profile_id
        AND title = 'Télécharger votre justificatif d''identité'
        AND status IN ('pending', 'completed')
      ) THEN
        INSERT INTO tasks (
          user_id,
          title,
          description,
          priority,
          status,
          task_type,
          related_entity_type
        ) VALUES (
          profile_id,
          'Télécharger votre justificatif d''identité',
          'Téléchargez votre pièce d''identité dans vos documents pour compléter votre vérification.',
          'important',
          'pending',
          'system',
          'document'
        );
      END IF;
    END IF;

    -- Tâche taxe foncière
    SELECT EXISTS (
      SELECT 1 FROM landlord_documents
      WHERE landlord_id = profile_id
      AND document_type = 'property_tax'
      AND status = 'approved'
    ) INTO task_exists;

    IF NOT task_exists THEN
      IF NOT EXISTS (
        SELECT 1 FROM tasks
        WHERE user_id = profile_id
        AND title = 'Télécharger votre taxe foncière'
        AND status IN ('pending', 'completed')
      ) THEN
        INSERT INTO tasks (
          user_id,
          title,
          description,
          priority,
          status,
          task_type,
          related_entity_type
        ) VALUES (
          profile_id,
          'Télécharger votre taxe foncière',
          'Téléchargez votre justificatif de propriété (taxe foncière) dans vos documents.',
          'important',
          'pending',
          'system',
          'document'
        );
      END IF;
    END IF;
  END IF;

  -- Tâches spécifiques pour les étudiants
  IF user_role = 'student' THEN
    -- Tâche attestation INSEAD
    SELECT EXISTS (
      SELECT 1 FROM student_documents
      WHERE student_id = profile_id
      AND document_type = 'accommodation_certificate'
      AND status = 'approved'
    ) INTO task_exists;

    IF NOT task_exists THEN
      IF NOT EXISTS (
        SELECT 1 FROM tasks
        WHERE user_id = profile_id
        AND title = 'Télécharger votre attestation INSEAD'
        AND status IN ('pending', 'completed')
      ) THEN
        INSERT INTO tasks (
          user_id,
          title,
          description,
          priority,
          status,
          task_type,
          related_entity_type
        ) VALUES (
          profile_id,
          'Télécharger votre attestation INSEAD',
          'Téléchargez votre attestation INSEAD dans vos documents pour compléter votre vérification.',
          'important',
          'pending',
          'system',
          'document'
        );
      END IF;
    END IF;
  END IF;
END;
$$;

-- Fonction pour marquer la tâche téléphone comme complétée
CREATE OR REPLACE FUNCTION complete_phone_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    UPDATE tasks
    SET
      status = 'completed',
      completed_at = now()
    WHERE
      user_id = NEW.id
      AND title = 'Ajouter votre numéro de téléphone'
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger sur la mise à jour du téléphone
DROP TRIGGER IF EXISTS after_phone_update ON profiles;
CREATE TRIGGER after_phone_update
  AFTER UPDATE OF phone ON profiles
  FOR EACH ROW
  WHEN (NEW.phone IS DISTINCT FROM OLD.phone)
  EXECUTE FUNCTION complete_phone_task();

-- Générer les tâches téléphone pour tous les profils existants sans téléphone
DO $$
DECLARE
  profile_record RECORD;
BEGIN
  FOR profile_record IN
    SELECT id, role FROM profiles
    WHERE (phone IS NULL OR phone = '')
    AND role IN ('landlord', 'student')
  LOOP
    PERFORM generate_profile_verification_tasks(profile_record.id, profile_record.role);
  END LOOP;
END $$;

/*
  # Activer le realtime pour la table profiles

  1. Changements
    - Active la réplication realtime pour la table `profiles`
    - Permet aux clients de recevoir les mises à jour en temps réel
  
  2. Notes
    - Nécessaire pour que le dashboard se mette à jour automatiquement
    - Les utilisateurs verront leurs changements de profil instantanément
*/

ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

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
/*
  # Add insead_attestation document type to student_documents

  1. Modified Tables
    - `student_documents`
      - Updated check constraint to include 'insead_attestation' as a valid document_type
  
  2. Important Notes
    - This allows students to submit INSEAD attestation documents through the same verification pipeline
    - Existing data is not affected as this is an additive change
*/

ALTER TABLE student_documents
  DROP CONSTRAINT IF EXISTS student_documents_document_type_check;

ALTER TABLE student_documents
  ADD CONSTRAINT student_documents_document_type_check
  CHECK (document_type = ANY (ARRAY[
    'id_card_front'::text,
    'id_card_back'::text,
    'accommodation_certificate'::text,
    'insurance_certificate'::text,
    'lease_copy'::text,
    'inventory_copy'::text,
    'insead_attestation'::text
  ]));

