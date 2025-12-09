/*
  # Système de génération automatique des tâches de vérification de profil

  1. Nouvelles Fonctions
    - `generate_profile_verification_tasks` : Génère automatiquement les tâches de vérification selon le rôle
    - `check_and_complete_verification_tasks` : Vérifie et complète les tâches de vérification

  2. Triggers
    - Génération automatique des tâches après création d'un profil
    - Complétion automatique des tâches lors de l'upload de documents
    - Complétion de la tâche photo de profil lors de l'ajout d'un avatar

  3. Détails des tâches générées
    Pour les propriétaires :
      - Photo de profil
      - Justificatif d'identité
      - Justificatif de propriété (taxe foncière)

    Pour les étudiants :
      - Photo de profil
      - Attestation INSEAD

  4. Sécurité
    - Utilise SECURITY DEFINER pour permettre l'insertion de tâches système
    - Vérifie les doublons avant de créer des tâches
*/

-- Fonction pour générer les tâches de vérification de profil
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

-- Trigger pour générer les tâches après la création d'un profil
CREATE OR REPLACE FUNCTION trigger_generate_profile_verification_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Générer les tâches immédiatement après la création du profil
  PERFORM generate_profile_verification_tasks(NEW.id, NEW.role);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_profile_insert_generate_tasks ON profiles;
CREATE TRIGGER after_profile_insert_generate_tasks
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_profile_verification_tasks();

-- Trigger pour marquer la tâche photo de profil comme complétée
CREATE OR REPLACE FUNCTION complete_profile_photo_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.avatar_url IS NOT NULL AND NEW.avatar_url != '' THEN
    UPDATE tasks
    SET
      status = 'completed',
      completed_at = now()
    WHERE
      user_id = NEW.id
      AND title = 'Ajouter une photo de profil'
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_profile_photo_update ON profiles;
CREATE TRIGGER after_profile_photo_update
  AFTER UPDATE OF avatar_url ON profiles
  FOR EACH ROW
  WHEN (NEW.avatar_url IS DISTINCT FROM OLD.avatar_url)
  EXECUTE FUNCTION complete_profile_photo_task();

-- Trigger pour marquer les tâches de documents propriétaire comme complétées
CREATE OR REPLACE FUNCTION complete_landlord_document_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_title text;
BEGIN
  -- Déterminer le titre de la tâche selon le type de document
  IF NEW.document_type = 'id_card' THEN
    task_title := 'Télécharger votre justificatif d''identité';
  ELSIF NEW.document_type = 'property_tax' THEN
    task_title := 'Télécharger votre taxe foncière';
  END IF;

  -- Marquer la tâche comme complétée
  IF task_title IS NOT NULL THEN
    UPDATE tasks
    SET
      status = 'completed',
      completed_at = now()
    WHERE
      user_id = NEW.landlord_id
      AND title = task_title
      AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_landlord_document_insert ON landlord_documents;
CREATE TRIGGER after_landlord_document_insert
  AFTER INSERT ON landlord_documents
  FOR EACH ROW
  EXECUTE FUNCTION complete_landlord_document_task();

-- Trigger pour marquer les tâches de documents étudiant comme complétées
CREATE OR REPLACE FUNCTION complete_student_document_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Marquer la tâche attestation INSEAD comme complétée
  IF NEW.document_type = 'accommodation_certificate' THEN
    UPDATE tasks
    SET
      status = 'completed',
      completed_at = now()
    WHERE
      user_id = NEW.student_id
      AND title = 'Télécharger votre attestation INSEAD'
      AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_student_document_insert ON student_documents;
CREATE TRIGGER after_student_document_insert
  AFTER INSERT ON student_documents
  FOR EACH ROW
  EXECUTE FUNCTION complete_student_document_task();

-- Générer les tâches de vérification pour tous les profils existants qui n'ont pas encore complété leur vérification
DO $$
DECLARE
  profile_record RECORD;
BEGIN
  FOR profile_record IN
    SELECT id, role FROM profiles
    WHERE role IN ('landlord', 'student')
  LOOP
    PERFORM generate_profile_verification_tasks(profile_record.id, profile_record.role);
  END LOOP;
END $$;
