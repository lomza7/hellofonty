-- Fix document upload task completion triggers
CREATE OR REPLACE FUNCTION complete_landlord_document_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_title text;
BEGIN
  IF NEW.document_type = 'id_card' THEN
    task_title := 'Télécharger votre justificatif d''identité';
  ELSIF NEW.document_type = 'property_tax' THEN
    task_title := 'Télécharger votre taxe foncière';
  END IF;

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
DROP TRIGGER IF EXISTS after_landlord_document_change ON landlord_documents;
CREATE TRIGGER after_landlord_document_change
  AFTER INSERT OR UPDATE ON landlord_documents
  FOR EACH ROW
  EXECUTE FUNCTION complete_landlord_document_task();

CREATE OR REPLACE FUNCTION complete_student_document_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.document_type IN ('accommodation_certificate', 'insead_attestation') THEN
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
DROP TRIGGER IF EXISTS after_student_document_change ON student_documents;
CREATE TRIGGER after_student_document_change
  AFTER INSERT OR UPDATE ON student_documents
  FOR EACH ROW
  EXECUTE FUNCTION complete_student_document_task();

-- Add Stripe onboarding task for landlords
DROP FUNCTION IF EXISTS generate_profile_verification_tasks(uuid, text);

CREATE FUNCTION generate_profile_verification_tasks(profile_id uuid, user_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_avatar boolean;
  has_id_doc boolean;
  has_tax_doc boolean;
  has_insead_doc boolean;
  has_stripe boolean;
BEGIN
  SELECT (avatar_url IS NOT NULL AND avatar_url != '') INTO has_avatar
  FROM profiles WHERE id = profile_id;

  IF NOT has_avatar THEN
    IF NOT EXISTS (SELECT 1 FROM tasks WHERE user_id = profile_id AND title = 'Ajouter une photo de profil') THEN
      INSERT INTO tasks (
        user_id, title, description, priority, status, task_type, related_entity_type
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

  IF user_role = 'landlord' THEN
    SELECT EXISTS (
      SELECT 1 FROM landlord_documents
      WHERE landlord_id = profile_id AND document_type = 'id_card'
    ) INTO has_id_doc;

    IF NOT has_id_doc THEN
      IF NOT EXISTS (SELECT 1 FROM tasks WHERE user_id = profile_id AND title = 'Télécharger votre justificatif d''identité') THEN
        INSERT INTO tasks (
          user_id, title, description, priority, status, task_type, related_entity_type
        ) VALUES (
          profile_id,
          'Télécharger votre justificatif d''identité',
          'Téléchargez une copie de votre pièce d''identité pour vérification.',
          'important',
          'pending',
          'system',
          'document'
        );
      END IF;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM landlord_documents
      WHERE landlord_id = profile_id AND document_type = 'property_tax'
    ) INTO has_tax_doc;

    IF NOT has_tax_doc THEN
      IF NOT EXISTS (SELECT 1 FROM tasks WHERE user_id = profile_id AND title = 'Télécharger votre taxe foncière') THEN
        INSERT INTO tasks (
          user_id, title, description, priority, status, task_type, related_entity_type
        ) VALUES (
          profile_id,
          'Télécharger votre taxe foncière',
          'Téléchargez votre avis de taxe foncière pour vérification.',
          'normal',
          'pending',
          'system',
          'document'
        );
      END IF;
    END IF;

    SELECT (stripe_onboarding_status = 'complete') INTO has_stripe
    FROM profiles WHERE id = profile_id;

    IF NOT has_stripe OR has_stripe IS NULL THEN
      IF NOT EXISTS (SELECT 1 FROM tasks WHERE user_id = profile_id AND title = 'Configurer votre compte de paiement Stripe') THEN
        INSERT INTO tasks (
          user_id, title, description, priority, status, task_type, related_entity_type
        ) VALUES (
          profile_id,
          'Configurer votre compte de paiement Stripe',
          'Configurez votre compte Stripe pour recevoir les paiements de vos locataires directement sur votre compte bancaire.',
          'important',
          'pending',
          'system',
          'payment'
        );
      END IF;
    END IF;
  END IF;

  IF user_role = 'student' THEN
    SELECT EXISTS (
      SELECT 1 FROM student_documents
      WHERE student_id = profile_id AND document_type IN ('accommodation_certificate', 'insead_attestation')
    ) INTO has_insead_doc;

    IF NOT has_insead_doc THEN
      IF NOT EXISTS (SELECT 1 FROM tasks WHERE user_id = profile_id AND title = 'Télécharger votre attestation INSEAD') THEN
        INSERT INTO tasks (
          user_id, title, description, priority, status, task_type, related_entity_type
        ) VALUES (
          profile_id,
          'Télécharger votre attestation INSEAD',
          'Téléchargez votre attestation INSEAD pour vérification.',
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

CREATE OR REPLACE FUNCTION complete_stripe_onboarding_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.stripe_onboarding_status = 'complete' THEN
    UPDATE tasks
    SET
      status = 'completed',
      completed_at = now()
    WHERE
      user_id = NEW.id
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

-- Backfill: create pending Stripe tasks for existing landlords without Stripe
INSERT INTO tasks (user_id, title, description, priority, status, task_type, related_entity_type)
SELECT
  p.id,
  'Configurer votre compte de paiement Stripe',
  'Configurez votre compte Stripe pour recevoir les paiements de vos locataires directement sur votre compte bancaire.',
  'important',
  'pending',
  'system',
  'payment'
FROM profiles p
WHERE p.role = 'landlord'
AND (p.stripe_onboarding_status IS NULL OR p.stripe_onboarding_status != 'complete')
AND NOT EXISTS (
  SELECT 1 FROM tasks t
  WHERE t.user_id = p.id
  AND t.title = 'Configurer votre compte de paiement Stripe'
);

UPDATE tasks
SET status = 'completed', completed_at = now()
WHERE title = 'Configurer votre compte de paiement Stripe'
AND status = 'pending'
AND EXISTS (
  SELECT 1 FROM profiles p
  WHERE p.id = tasks.user_id
  AND p.stripe_onboarding_status = 'complete'
);

-- Reset Stripe data for platform account migration
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_migration_needed boolean DEFAULT false;

UPDATE profiles
SET stripe_migration_needed = true
WHERE stripe_account_id IS NOT NULL;

UPDATE profiles
SET
  stripe_account_id = NULL,
  stripe_onboarding_status = 'not_connected',
  stripe_charges_enabled = false,
  stripe_payouts_enabled = false,
  stripe_details_submitted = false,
  stripe_onboarding_updated_at = NULL
WHERE stripe_account_id IS NOT NULL;

UPDATE tasks
SET
  status = 'pending',
  completed_at = NULL
WHERE title = 'Configurer votre compte de paiement Stripe'
AND status = 'completed';

DELETE FROM stripe_customers;
DELETE FROM stripe_subscriptions;
DELETE FROM stripe_orders;

-- Add unique constraint on imported_blocked_dates.event_uid
DROP INDEX IF EXISTS idx_imported_blocked_dates_uid;
CREATE UNIQUE INDEX IF NOT EXISTS idx_imported_blocked_dates_event_uid_unique
  ON imported_blocked_dates (event_uid);

-- Enable pg_cron and pg_net, schedule iCal sync every 10 minutes
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('sync-ical-feeds-every-10min')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-ical-feeds-every-10min'
);

SELECT cron.schedule(
  'sync-ical-feeds-every-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/sync-all-calendars',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
