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
