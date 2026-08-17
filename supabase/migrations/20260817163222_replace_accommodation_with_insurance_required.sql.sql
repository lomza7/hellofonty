/*
# Replace accommodation certificate with home insurance as required student document

1. Context
   - Previously, students were required to upload an "attestation d'hébergement" (accommodation_certificate)
     as a mandatory document. Following user feedback, this is no longer required.
   - The home insurance certificate (insurance_certificate) becomes the mandatory document instead.
   - The accommodation_certificate remains available as an optional/complementary document.

2. Changes to `generate_profile_verification_tasks`
   - The function now checks whether the student has an approved `insurance_certificate`
     (instead of `accommodation_certificate`) to decide whether to create the verification task.
   - The task title changes from "Télécharger votre attestation INSEAD" to
     "Télécharger votre assurance habitation" with an updated description.

3. Changes to `complete_student_document_task`
   - The trigger now completes the task "Télécharger votre assurance habitation" when an
     `insurance_certificate` is uploaded (instead of completing the INSEAD attestation task
     on `accommodation_certificate` upload).
   - The `insead_attestation` document type is preserved and still completes the
     "Télécharger votre attestation INSEAD" task if one exists.

4. Data migration
   - Existing pending tasks titled "Télécharger votre attestation INSEAD" that were tied to
     the accommodation_certificate flow are renamed to "Télécharger votre assurance habitation"
     so students see the correct task on their dashboard.

5. Security
   - No RLS policy changes. All functions remain SECURITY DEFINER as before.
   - No new tables or columns are created.
*/

-- 1. Update generate_profile_verification_tasks: check insurance_certificate instead of accommodation_certificate
CREATE OR REPLACE FUNCTION generate_profile_verification_tasks(profile_id uuid, user_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_exists boolean;
BEGIN
  -- Tâches communes à tous les utilisateurs
  IF user_role IN ('landlord', 'student', 'manager') THEN
    -- Tâche photo de profil
    SELECT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = profile_id
      AND avatar_url IS NOT NULL
      AND avatar_url != ''
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
          'Ajoutez une photo de profil pour personnaliser votre compte et rassurer les autres utilisateurs.',
          'normal',
          'pending',
          'system',
          'profile'
        );
      END IF;
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
          'Téléchargez une copie de votre pièce d''identité dans vos documents propriétaire.',
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
    -- Tâche assurance habitation (remplace l'attestation d'hébergement)
    SELECT EXISTS (
      SELECT 1 FROM student_documents
      WHERE student_id = profile_id
      AND document_type = 'insurance_certificate'
      AND status = 'approved'
    ) INTO task_exists;

    IF NOT task_exists THEN
      IF NOT EXISTS (
        SELECT 1 FROM tasks
        WHERE user_id = profile_id
        AND title = 'Télécharger votre assurance habitation'
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
          'Télécharger votre assurance habitation',
          'Téléchargez votre attestation d''assurance habitation dans vos documents pour compléter votre vérification.',
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

-- 2. Update complete_student_document_task: complete insurance task on insurance_certificate upload
CREATE OR REPLACE FUNCTION complete_student_document_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Complete the home insurance task when insurance_certificate is uploaded
  IF NEW.document_type = 'insurance_certificate' THEN
    UPDATE tasks
    SET
      status = 'completed',
      completed_at = now()
    WHERE
      user_id = NEW.student_id
      AND title = 'Télécharger votre assurance habitation'
      AND status = 'pending';
  END IF;

  -- Keep handling insead_attestation for the INSEAD attestation task
  IF NEW.document_type = 'insead_attestation' THEN
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

-- Re-create the trigger (drop old, create new) to ensure it fires on INSERT and UPDATE
DROP TRIGGER IF EXISTS after_student_document_insert ON student_documents;
DROP TRIGGER IF EXISTS after_student_document_change ON student_documents;
CREATE TRIGGER after_student_document_change
  AFTER INSERT OR UPDATE ON student_documents
  FOR EACH ROW
  EXECUTE FUNCTION complete_student_document_task();

-- 3. Rename existing pending tasks from the old INSEAD attestation title to the new insurance title
--    so current students see the correct task on their dashboard.
UPDATE tasks
SET
  title = 'Télécharger votre assurance habitation',
  description = 'Téléchargez votre attestation d''assurance habitation dans vos documents pour compléter votre vérification.'
WHERE
  title = 'Télécharger votre attestation INSEAD'
  AND status = 'pending'
  AND user_id IN (SELECT id FROM profiles WHERE role = 'student');

-- 4. Regenerate verification tasks for all existing students to ensure the new task exists
DO $$
DECLARE
  profile_record RECORD;
BEGIN
  FOR profile_record IN
    SELECT id, role FROM profiles
    WHERE role = 'student'
  LOOP
    PERFORM generate_profile_verification_tasks(profile_record.id, profile_record.role);
  END LOOP;
END $$;
