/*
# Restore Stripe onboarding task for landlords

## Context
The migration `20260817163222_replace_accommodation_with_insurance_required` rewrote
`generate_profile_verification_tasks()` but accidentally dropped the Stripe onboarding
task block that was added in `20260521201508_add_stripe_onboarding_task_for_landlords`.
As a result, new landlords no longer get the "Configurer votre compte de paiement Stripe"
task on their dashboard.

## Changes
1. Recreate `generate_profile_verification_tasks()` with the Stripe block restored,
   keeping all other tasks (profile photo, ID card, property tax, insurance) intact.
2. Backfill: create the pending Stripe task for existing landlords who don't have it yet
   and whose Stripe onboarding is not complete.
3. The auto-complete trigger (`complete_stripe_onboarding_task`) already exists from the
   original migration and is unaffected — it will still mark the task as completed when
   `stripe_onboarding_status` becomes 'complete'.

## No data loss
- No tables or columns are dropped or renamed.
- Existing tasks are untouched; only missing Stripe tasks are inserted.
*/

-- 1. Recreate the function with the Stripe block restored
CREATE OR REPLACE FUNCTION generate_profile_verification_tasks(profile_id uuid, user_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_exists boolean;
  has_stripe boolean;
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
          user_id, title, description, priority, status, task_type, related_entity_type
        ) VALUES (
          profile_id,
          'Ajouter une photo de profil',
          'Ajoutez une photo de profil pour personnaliser votre compte et rassurer les autres utilisateurs.',
          'normal', 'pending', 'system', 'profile'
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
          user_id, title, description, priority, status, task_type, related_entity_type
        ) VALUES (
          profile_id,
          'Télécharger votre justificatif d''identité',
          'Téléchargez une copie de votre pièce d''identité dans vos documents propriétaire.',
          'important', 'pending', 'system', 'document'
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
          user_id, title, description, priority, status, task_type, related_entity_type
        ) VALUES (
          profile_id,
          'Télécharger votre taxe foncière',
          'Téléchargez votre justificatif de propriété (taxe foncière) dans vos documents.',
          'important', 'pending', 'system', 'document'
        );
      END IF;
    END IF;

    -- Tâche Stripe (restaurée)
    SELECT (stripe_onboarding_status = 'complete') INTO has_stripe
    FROM profiles WHERE id = profile_id;

    IF NOT has_stripe OR has_stripe IS NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM tasks
        WHERE user_id = profile_id
        AND title = 'Configurer votre compte de paiement Stripe'
        AND status IN ('pending', 'completed')
      ) THEN
        INSERT INTO tasks (
          user_id, title, description, priority, status, task_type, related_entity_type
        ) VALUES (
          profile_id,
          'Configurer votre compte de paiement Stripe',
          'Configurez votre compte Stripe pour recevoir les paiements de vos locataires directement sur votre compte bancaire.',
          'important', 'pending', 'system', 'payment'
        );
      END IF;
    END IF;
  END IF;

  -- Tâches spécifiques pour les étudiants
  IF user_role = 'student' THEN
    -- Tâche assurance habitation
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
          user_id, title, description, priority, status, task_type, related_entity_type
        ) VALUES (
          profile_id,
          'Télécharger votre assurance habitation',
          'Téléchargez votre attestation d''assurance habitation dans vos documents pour compléter votre vérification.',
          'important', 'pending', 'system', 'document'
        );
      END IF;
    END IF;
  END IF;
END;
$$;

-- 2. Backfill: create the Stripe task for existing landlords who are missing it
INSERT INTO tasks (user_id, title, description, priority, status, task_type, related_entity_type)
SELECT
  p.id,
  'Configurer votre compte de paiement Stripe',
  'Configurez votre compte Stripe pour recevoir les paiements de vos locataires directement sur votre compte bancaire.',
  'important', 'pending', 'system', 'payment'
FROM profiles p
WHERE p.role = 'landlord'
AND (p.stripe_onboarding_status IS NULL OR p.stripe_onboarding_status != 'complete')
AND NOT EXISTS (
  SELECT 1 FROM tasks t
  WHERE t.user_id = p.id
  AND t.title = 'Configurer votre compte de paiement Stripe'
);

-- 3. Ensure the auto-complete trigger still exists (idempotent)
DROP FUNCTION IF EXISTS complete_stripe_onboarding_task() CASCADE;
CREATE OR REPLACE FUNCTION complete_stripe_onboarding_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.stripe_onboarding_status = 'complete' THEN
    UPDATE tasks
    SET status = 'completed', completed_at = now()
    WHERE user_id = NEW.id
    AND title = 'Configurer votre compte de paiement Stripe'
    AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_stripe_onboarding_complete ON profiles;
CREATE TRIGGER after_stripe_onboarding_complete
  AFTER UPDATE OF stripe_onboarding_status ON profiles
  FOR EACH ROW
  WHEN (NEW.stripe_onboarding_status IS DISTINCT FROM OLD.stripe_onboarding_status)
  EXECUTE FUNCTION complete_stripe_onboarding_task();
