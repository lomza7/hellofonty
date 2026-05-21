/*
  # Add Stripe onboarding task for landlords

  1. Changes
    - Update generate_profile_verification_tasks() to also create a Stripe onboarding task for landlords
    - Add trigger on profiles to auto-complete the Stripe task when stripe_onboarding_status becomes 'complete'
    - Backfill: create pending Stripe tasks for existing landlords who haven't connected Stripe yet

  2. Task Details
    - Title: "Configurer votre compte de paiement Stripe"
    - Priority: important
    - Related entity type: payment
    - Auto-completes when stripe_onboarding_status = 'complete'
*/

-- Drop and recreate with correct parameter names
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

-- Trigger to auto-complete Stripe task when onboarding is complete
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

-- Mark as completed for landlords who already have Stripe connected
UPDATE tasks
SET status = 'completed', completed_at = now()
WHERE title = 'Configurer votre compte de paiement Stripe'
AND status = 'pending'
AND EXISTS (
  SELECT 1 FROM profiles p
  WHERE p.id = tasks.user_id
  AND p.stripe_onboarding_status = 'complete'
);