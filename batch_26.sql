/*
  # Multi-account Stripe Connect for landlords

  ## Purpose
  Allow a landlord to connect multiple Stripe Connect accounts (e.g. personal account,
  SCI account) and choose which one receives payments for each listing.

  ## New Tables
  - `landlord_stripe_accounts`
    - `id` (uuid, primary key)
    - `landlord_id` (uuid, references profiles.id) — the landlord who owns this Stripe account
    - `stripe_account_id` (text) — the Stripe Express account ID (acct_xxx)
    - `label` (text) — user-friendly name like "Compte personnel" or "SCI Fontainebleau"
    - `is_default` (boolean, default false) — marks the primary account
    - `stripe_charges_enabled` (boolean, default false)
    - `stripe_payouts_enabled` (boolean, default false)
    - `stripe_details_submitted` (boolean, default false)
    - `stripe_onboarding_status` (text, default 'not_connected')
    - `stripe_onboarding_updated_at` (timestamptz)
    - `created_at` (timestamptz, default now())
    - `updated_at` (timestamptz, default now())

  ## Modified Tables
  - `listings`
    - Added `stripe_account_id` (text, nullable) — when set, payments for this listing
      go to this specific Stripe account. When NULL, falls back to the landlord's
      default account (the one marked is_default=true, or the profile-level stripe_account_id
      for backward compatibility).

  ## Security
  - RLS enabled on `landlord_stripe_accounts`
  - Only the landlord who owns the account can SELECT, INSERT, UPDATE, DELETE
  - Uses auth.uid() = landlord_id for ownership checks

  ## Backward Compatibility
  - Existing landlords with `profiles.stripe_account_id` continue to work.
  - A migration backfills a `landlord_stripe_accounts` row for every existing
    `profiles.stripe_account_id`, marked as default.
  - Listings without `stripe_account_id` fall back to the default account.
*/

-- 1. Create landlord_stripe_accounts table
CREATE TABLE IF NOT EXISTS landlord_stripe_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_account_id text NOT NULL,
  label text NOT NULL DEFAULT 'Compte principal',
  is_default boolean NOT NULL DEFAULT false,
  stripe_charges_enabled boolean NOT NULL DEFAULT false,
  stripe_payouts_enabled boolean NOT NULL DEFAULT false,
  stripe_details_submitted boolean NOT NULL DEFAULT false,
  stripe_onboarding_status text NOT NULL DEFAULT 'not_connected',
  stripe_onboarding_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE landlord_stripe_accounts ENABLE ROW LEVEL SECURITY;

-- Index for fast lookups by landlord
CREATE INDEX IF NOT EXISTS idx_landlord_stripe_accounts_landlord_id
  ON landlord_stripe_accounts(landlord_id);

CREATE INDEX IF NOT EXISTS idx_landlord_stripe_accounts_stripe_account_id
  ON landlord_stripe_accounts(stripe_account_id);

-- RLS policies: landlord can only manage their own accounts
DROP POLICY IF EXISTS "select_own_stripe_accounts" ON landlord_stripe_accounts;
CREATE POLICY "select_own_stripe_accounts"
  ON landlord_stripe_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = landlord_id);

DROP POLICY IF EXISTS "insert_own_stripe_accounts" ON landlord_stripe_accounts;
CREATE POLICY "insert_own_stripe_accounts"
  ON landlord_stripe_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = landlord_id);

DROP POLICY IF EXISTS "update_own_stripe_accounts" ON landlord_stripe_accounts;
CREATE POLICY "update_own_stripe_accounts"
  ON landlord_stripe_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = landlord_id)
  WITH CHECK (auth.uid() = landlord_id);

DROP POLICY IF EXISTS "delete_own_stripe_accounts" ON landlord_stripe_accounts;
CREATE POLICY "delete_own_stripe_accounts"
  ON landlord_stripe_accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = landlord_id);

-- 2. Add stripe_account_id to listings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'stripe_account_id'
  ) THEN
    ALTER TABLE listings ADD COLUMN stripe_account_id text;
  END IF;
END $$;

-- Allow landlords to update the stripe_account_id on their own listings
-- (The existing listings policies already allow landlords to update their own rows,
--  so no new policy is needed — the column is just a new nullable field.)

-- 3. Backfill: create a landlord_stripe_accounts row for every existing profile stripe_account_id
INSERT INTO landlord_stripe_accounts (
  landlord_id, stripe_account_id, label, is_default,
  stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted,
  stripe_onboarding_status, stripe_onboarding_updated_at
)
SELECT
  p.id,
  p.stripe_account_id,
  'Compte principal',
  true,
  COALESCE(p.stripe_charges_enabled, false),
  COALESCE(p.stripe_payouts_enabled, false),
  COALESCE(p.stripe_details_submitted, false),
  COALESCE(p.stripe_onboarding_status, 'not_connected'),
  p.stripe_onboarding_updated_at
FROM profiles p
WHERE p.stripe_account_id IS NOT NULL
  AND p.role = 'landlord'
  AND NOT EXISTS (
    SELECT 1 FROM landlord_stripe_accounts lsa
    WHERE lsa.stripe_account_id = p.stripe_account_id
  );

-- 4. Backfill: set listings.stripe_account_id to the landlord's default account
--    so existing listings use the same account they always did
UPDATE listings l
SET stripe_account_id = lsa.stripe_account_id
FROM landlord_stripe_accounts lsa
WHERE lsa.landlord_id = l.landlord_id
  AND lsa.is_default = true
  AND l.stripe_account_id IS NULL;

/*
# Suivi des cautions (deposit_transactions)

## Contexte
Cette table centralise le suivi de chaque caution (depot de garantie) encaissee sur la plateforme.
Elle permet aux proprietaires de gerer les remboursements (totaux ou partiels avec retenue),
et aux etudiants, managers et admins de consulter le statut de chaque caution.

## Nouvelle table: deposit_transactions

- `id` (uuid, primary key)
- `booking_id` (uuid, references bookings, NOT NULL) - La reservation associee
- `listing_id` (uuid, references listings, NOT NULL) - L'annonce associee
- `landlord_id` (uuid, references profiles, NOT NULL) - Le proprietaire
- `student_id` (uuid, references profiles, NOT NULL) - L'etudiant
- `deposit_amount` (numeric(10,2), NOT NULL) - Montant total de la caution encaissee
- `retained_amount` (numeric(10,2), DEFAULT 0) - Montant retenu par le proprietaire
- `refunded_amount` (numeric(10,2), DEFAULT 0) - Montant rembourse a l'etudiant
- `retention_reason` (text, nullable) - Motif de la retenue
- `status` (text, NOT NULL, CHECK IN ('collected', 'refunding', 'refunded', 'retained'))
  - 'collected': caution encaissee, en attente de remboursement
  - 'refunding': remboursement en cours
  - 'refunded': caution entierement remboursee
  - 'retained': caution partiellement retenue et le reste rembourse
- `stripe_payment_intent_id` (text, nullable) - Lien vers le paiement Stripe original
- `stripe_refund_id` (text, nullable) - ID du remboursement Stripe
- `collected_at` (timestamptz, NOT NULL) - Date d'encaissement
- `refunded_at` (timestamptz, nullable) - Date de remboursement
- `created_at` (timestamptz, DEFAULT now())
- `updated_at` (timestamptz, DEFAULT now())

## Securite (RLS)

- RLS active sur deposit_transactions
- SELECT: les proprietaires voient leurs cautions, les etudiants voient leurs cautions,
  les managers voient les cautions des annonces qui leur sont attribuees, les admins voient tout
- INSERT: uniquement via service role (edge function) - pas de politique pour authenticated
- UPDATE: uniquement le proprietaire peut modifier ses cautions (statut, retenue, remboursement)

## Remplissage initial

- Insertion automatique des cautions existantes depuis les bookings qui ont un deposit_amount > 0
  et un payment_status = 'completed'

## Index

- Index sur landlord_id pour les requetes proprietaire
- Index sur student_id pour les requetes etudiant
- Index sur listing_id pour les requetes manager
- Index sur status pour les filtres
*/

CREATE TABLE IF NOT EXISTS deposit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  landlord_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  deposit_amount numeric(10, 2) NOT NULL,
  retained_amount numeric(10, 2) NOT NULL DEFAULT 0,
  refunded_amount numeric(10, 2) NOT NULL DEFAULT 0,
  retention_reason text,
  status text NOT NULL DEFAULT 'collected' CHECK (status IN ('collected', 'refunding', 'refunded', 'retained')),
  stripe_payment_intent_id text,
  stripe_refund_id text,
  collected_at timestamptz NOT NULL DEFAULT now(),
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE deposit_transactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_deposit_transactions_landlord_id ON deposit_transactions(landlord_id);
CREATE INDEX IF NOT EXISTS idx_deposit_transactions_student_id ON deposit_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_deposit_transactions_listing_id ON deposit_transactions(listing_id);
CREATE INDEX IF NOT EXISTS idx_deposit_transactions_status ON deposit_transactions(status);

-- Policy: landlords can SELECT their own deposits
DROP POLICY IF EXISTS "select_own_deposits" ON deposit_transactions;
CREATE POLICY "select_own_deposits"
ON deposit_transactions FOR SELECT
TO authenticated
USING (auth.uid() = landlord_id);

-- Policy: students can SELECT their own deposits
DROP POLICY IF EXISTS "select_student_deposits" ON deposit_transactions;
CREATE POLICY "select_student_deposits"
ON deposit_transactions FOR SELECT
TO authenticated
USING (auth.uid() = student_id);

-- Policy: managers can SELECT deposits for listings assigned to them
DROP POLICY IF EXISTS "select_manager_deposits" ON deposit_transactions;
CREATE POLICY "select_manager_deposits"
ON deposit_transactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM manager_assignments
    WHERE manager_assignments.listing_id = deposit_transactions.listing_id
    AND manager_assignments.manager_id = auth.uid()
  )
);

-- Policy: admins can SELECT all deposits
DROP POLICY IF EXISTS "select_admin_deposits" ON deposit_transactions;
CREATE POLICY "select_admin_deposits"
ON deposit_transactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: landlords can UPDATE their own deposits (status, retention, refund)
DROP POLICY IF EXISTS "update_own_deposits" ON deposit_transactions;
CREATE POLICY "update_own_deposits"
ON deposit_transactions FOR UPDATE
TO authenticated
USING (auth.uid() = landlord_id)
WITH CHECK (auth.uid() = landlord_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_deposit_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_deposit_transactions_updated_at ON deposit_transactions;
CREATE TRIGGER trigger_deposit_transactions_updated_at
BEFORE UPDATE ON deposit_transactions
FOR EACH ROW
EXECUTE FUNCTION update_deposit_transactions_updated_at();

-- Populate from existing bookings with deposits
INSERT INTO deposit_transactions (booking_id, listing_id, landlord_id, student_id, deposit_amount, status, stripe_payment_intent_id, collected_at)
SELECT
  b.id,
  b.listing_id,
  l.landlord_id,
  b.student_id,
  b.deposit_amount,
  'collected',
  b.stripe_payment_intent_id,
  b.created_at
FROM bookings b
JOIN listings l ON l.id = b.listing_id
WHERE b.deposit_amount > 0
  AND b.payment_status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM deposit_transactions dt WHERE dt.booking_id = b.id
  );

/*
# Add deposit_refund to notifications type check constraint

1. Modified Tables
   - `notifications`: update the `notifications_type_check` constraint to include `deposit_refund` type.

2. Important Notes
   - This allows sending a notification to the student when the landlord refunds a deposit (full or partial with retention).
*/

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY['message', 'booking_request', 'booking_confirmed', 'booking_cancelled', 'lease_signature_request', 'lease_signed', 'deposit_refund'])
);

-- Add unique constraint on booking_id for upsert support
CREATE UNIQUE INDEX IF NOT EXISTS idx_deposit_transactions_booking_id_unique
  ON deposit_transactions(booking_id);
/*
# Add lease type preference and custom lease support

1. New Columns
- `profiles.preferred_lease_type` (text, default 'hellofonty') : Stores the landlord's choice between
  the HelloFonty model lease ('hellofonty') and their own custom lease document ('custom').
- `leases.lease_source` (text, default 'hellofonty') : Distinguishes leases generated from the
  HelloFonty template ('hellofonty') from those where the landlord uploaded their own document ('custom').

2. New Storage Bucket
- `lease-documents` (private) : Stores custom lease documents uploaded by landlords (PDF/Word).
  Only the landlord who owns the lease and the tenant linked to it can access the files.

3. Security
- RLS policies on `lease-documents` bucket: landlord (owner of the lease) and tenant can read;
  landlord can upload/update/delete their own lease documents.
- No changes to existing table RLS — existing policies remain intact.

4. Important Notes
- The `preferred_lease_type` column defaults to 'hellofonty' so existing landlords keep the current behavior.
- The `lease_source` column defaults to 'hellofonty' so existing leases are treated as HelloFonty model leases.
- The storage bucket is private (not public) to protect sensitive lease documents.
*/

-- Add preferred_lease_type to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'preferred_lease_type'
  ) THEN
    ALTER TABLE profiles ADD COLUMN preferred_lease_type text NOT NULL DEFAULT 'hellofonty';
  END IF;
END $$;

-- Add lease_source to leases
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leases' AND column_name = 'lease_source'
  ) THEN
    ALTER TABLE leases ADD COLUMN lease_source text NOT NULL DEFAULT 'hellofonty';
  END IF;
END $$;

-- Create lease-documents storage bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lease-documents',
  'lease-documents',
  false,
  20971520, -- 20 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for lease-documents bucket
-- Read: landlord who owns the lease or tenant linked to the lease
DROP POLICY IF EXISTS "Landlords can read their lease documents" ON storage.objects;
CREATE POLICY "Landlords can read their lease documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'lease-documents'
    AND EXISTS (
      SELECT 1 FROM leases
      WHERE leases.landlord_id = auth.uid()
      AND leases.document_url = name
    )
  );

DROP POLICY IF EXISTS "Tenants can read their lease documents" ON storage.objects;
CREATE POLICY "Tenants can read their lease documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'lease-documents'
    AND EXISTS (
      SELECT 1 FROM leases
      WHERE leases.tenant_id = auth.uid()
      AND leases.document_url = name
    )
  );

-- Upload: landlord can upload files to their own folder
DROP POLICY IF EXISTS "Landlords can upload lease documents" ON storage.objects;
CREATE POLICY "Landlords can upload lease documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'lease-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update: landlord can update their own files
DROP POLICY IF EXISTS "Landlords can update their lease documents" ON storage.objects;
CREATE POLICY "Landlords can update their lease documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'lease-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'lease-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete: landlord can delete their own files
DROP POLICY IF EXISTS "Landlords can delete their lease documents" ON storage.objects;
CREATE POLICY "Landlords can delete their lease documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'lease-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

