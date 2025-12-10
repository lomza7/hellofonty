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
