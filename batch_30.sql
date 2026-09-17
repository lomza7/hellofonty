/*
# Allow AVIF format in images bucket

1. Changes
   - Update the `images` storage bucket to include `image/avif` in allowed_mime_types.
   - This prevents "mime type image/avif is not supported" errors when uploading
     photos imported from Airbnb (which often serves AVIF images).
2. Notes
   - No data is lost; this only modifies bucket metadata.
   - The bucket already accepts jpeg, png, webp, gif.
*/

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
]
WHERE id = 'images';

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

-- Add lease_id column to invoices to track per-lease subscription charges
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS lease_id uuid;

-- Add index for faster duplicate-check queries
CREATE INDEX IF NOT EXISTS idx_invoices_lease_id ON invoices(lease_id);

-- Add foreign key constraint (optional, but ensures referential integrity)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'invoices_lease_id_fkey'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_lease_id_fkey
      FOREIGN KEY (lease_id) REFERENCES leases(id) ON DELETE SET NULL;
  END IF;
END $$;

/*
# Suivi des prélèvements d'abonnement propriétaires et exonérations

1. Nouvelle table `landlord_subscription_charges`
   - Enregistre chaque prélèvement mensuel de 59 € par propriétaire et par bail.
   - Statuts: pending (à prélever), paid (prélevé), failed (échec / impayé), exempted (exonéré), cancelled.
   - Conserve la raison de l'échec, la date de dernière tentative, l'ID de charge Stripe.
   - Contrainte unique sur (landlord_id, lease_id, period_month) pour éviter les doublons.

2. Colonnes ajoutées à `profiles`
   - `subscription_exempt` (boolean, défaut false): exonération permanente des frais Premium.
   - `subscription_exempt_reason` (text): raison interne de l'exonération.
   - `subscription_exempt_until` (timestamptz): fin d'exonération temporaire (null = permanent).

3. Sécurité
   - RLS activée sur `landlord_subscription_charges`.
   - Les administrateurs (role = 'admin') peuvent lire et modifier.
   - Les propriétaires peuvent lire leurs propres lignes.
   - Insert/update réservés aux administrateurs via service role ou admin.
*/

-- 1. Nouvelle table de suivi des prélèvements
CREATE TABLE IF NOT EXISTS landlord_subscription_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lease_id uuid REFERENCES leases(id) ON DELETE SET NULL,
  listing_id uuid,
  period_month text NOT NULL,
  amount integer NOT NULL DEFAULT 5900,
  currency text NOT NULL DEFAULT 'eur',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'exempted', 'cancelled')),
  stripe_charge_id text,
  failure_reason text,
  last_attempt_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(landlord_id, lease_id, period_month)
);

ALTER TABLE landlord_subscription_charges ENABLE ROW LEVEL SECURITY;

-- Policies: admin full access, landlord read-only own rows
DROP POLICY IF EXISTS "admin_read_subscription_charges" ON landlord_subscription_charges;
CREATE POLICY "admin_read_subscription_charges"
  ON landlord_subscription_charges FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "landlord_read_own_charges" ON landlord_subscription_charges;
CREATE POLICY "landlord_read_own_charges"
  ON landlord_subscription_charges FOR SELECT
  TO authenticated
  USING (auth.uid() = landlord_id);

DROP POLICY IF EXISTS "admin_insert_subscription_charges" ON landlord_subscription_charges;
CREATE POLICY "admin_insert_subscription_charges"
  ON landlord_subscription_charges FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_update_subscription_charges" ON landlord_subscription_charges;
CREATE POLICY "admin_update_subscription_charges"
  ON landlord_subscription_charges FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_lsc_landlord_id ON landlord_subscription_charges(landlord_id);
CREATE INDEX IF NOT EXISTS idx_lsc_lease_id ON landlord_subscription_charges(lease_id);
CREATE INDEX IF NOT EXISTS idx_lsc_status ON landlord_subscription_charges(status);
CREATE INDEX IF NOT EXISTS idx_lsc_period_month ON landlord_subscription_charges(period_month);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_lsc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lsc_updated_at ON landlord_subscription_charges;
CREATE TRIGGER trg_lsc_updated_at
  BEFORE UPDATE ON landlord_subscription_charges
  FOR EACH ROW
  EXECUTE FUNCTION update_lsc_updated_at();

-- 2. Colonnes d'exonération sur profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_exempt boolean NOT NULL DEFAULT false;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_exempt_reason text;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_exempt_until timestamptz;

-- Permettre aux admins de mettre à jour l'exonération (déjà couvert par la policy admin existante,
-- mais on s'assure que la colonne est visible)

-- Ensure only one default Stripe account per landlord
-- This prevents data corruption where multiple accounts could be marked as default

-- First, fix any existing data: if a landlord has multiple defaults,
-- keep only the oldest one as default
DO $$
BEGIN
  WITH duplicates AS (
    SELECT landlord_id, id AS keep_id
    FROM (
      SELECT landlord_id, id,
        ROW_NUMBER() OVER (PARTITION BY landlord_id ORDER BY created_at ASC) AS rn
      FROM landlord_stripe_accounts
      WHERE is_default = true
    ) ranked
    WHERE rn = 1
  )
  UPDATE landlord_stripe_accounts lsa
  SET is_default = false, updated_at = now()
  WHERE lsa.is_default = true
    AND lsa.id NOT IN (SELECT keep_id FROM duplicates);
END $$;

-- Add a partial unique index so only one account can be default per landlord
DROP INDEX IF EXISTS idx_landlord_stripe_accounts_one_default;
CREATE UNIQUE INDEX idx_landlord_stripe_accounts_one_default
  ON landlord_stripe_accounts(landlord_id)
  WHERE is_default = true;

