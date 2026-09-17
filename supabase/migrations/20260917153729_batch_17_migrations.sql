-- Ajout de la tâche de vérification du numéro de téléphone
CREATE OR REPLACE FUNCTION generate_profile_verification_tasks(profile_id uuid, user_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = profile_id AND avatar_url IS NOT NULL AND avatar_url != ''
  ) INTO task_exists;

  IF NOT task_exists THEN
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

  IF user_role = 'landlord' THEN
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

  IF user_role = 'student' THEN
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

DROP TRIGGER IF EXISTS after_phone_update ON profiles;
CREATE TRIGGER after_phone_update
  AFTER UPDATE OF phone ON profiles
  FOR EACH ROW
  WHEN (NEW.phone IS DISTINCT FROM OLD.phone)
  EXECUTE FUNCTION complete_phone_task();

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

-- Activer le realtime pour la table profiles
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- Ajouter des champs détaillés à feature_carousel_images
DO $$
BEGIN
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

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_carousel_images' AND column_name = 'features'
  ) THEN
    ALTER TABLE feature_carousel_images ADD COLUMN features jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_carousel_images' AND column_name = 'video_url'
  ) THEN
    ALTER TABLE feature_carousel_images ADD COLUMN video_url text;
  END IF;

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

-- Ajout du type d'utilisateur aux fonctionnalités
ALTER TABLE feature_carousel_images 
ADD COLUMN IF NOT EXISTS user_type text DEFAULT 'both' CHECK (user_type IN ('student', 'landlord', 'both'));

CREATE INDEX IF NOT EXISTS idx_feature_carousel_user_type 
ON feature_carousel_images(user_type) 
WHERE is_active = true;

-- Add insead_attestation document type to student_documents
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
