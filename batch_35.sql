-- Add 'refunded' status to landlord_subscription_charges
ALTER TABLE landlord_subscription_charges
  DROP CONSTRAINT IF EXISTS landlord_subscription_charges_status_check;

ALTER TABLE landlord_subscription_charges
  ADD CONSTRAINT landlord_subscription_charges_status_check
  CHECK (status IN ('pending', 'paid', 'failed', 'exempted', 'cancelled', 'refunded'));

-- Add refund tracking columns
ALTER TABLE landlord_subscription_charges
  ADD COLUMN IF NOT EXISTS stripe_refund_id text;

ALTER TABLE landlord_subscription_charges
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

ALTER TABLE landlord_subscription_charges
  ADD COLUMN IF NOT EXISTS refund_reason text;

ALTER TABLE landlord_subscription_charges
  ADD COLUMN IF NOT EXISTS refund_amount integer;

ALTER TABLE landlord_subscription_charges
  ADD COLUMN IF NOT EXISTS refunded_by_admin uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Add refunded status to invoices
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('paid', 'open', 'void', 'uncollectible', 'refunded'));

-- Add Stripe charge tracking columns to rent_payments
ALTER TABLE rent_payments
  ADD COLUMN IF NOT EXISTS stripe_charge_id text;

ALTER TABLE rent_payments
  ADD COLUMN IF NOT EXISTS stripe_payout_id text;

ALTER TABLE rent_payments
  ADD COLUMN IF NOT EXISTS stripe_payout_date timestamptz;

ALTER TABLE rent_payments
  ADD COLUMN IF NOT EXISTS stripe_session_id text;

-- Add index for faster lookups by stripe_payment_intent_id
CREATE INDEX IF NOT EXISTS rent_payments_stripe_payment_intent_id_idx
  ON rent_payments (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

/*
# Fix Marta Lopez listing Stripe account association

## Problem
Marta Lopez's listing "INSEAD - Appartement vintage elegant" (id: 674598c3-bcc9-4347-a138-778ae2367291)
is associated with an orphaned Stripe account `acct_1U3wcc2eLa0Xabjl` that does not exist
in `landlord_stripe_accounts`. Her active, fully-onboarded account is `acct_1Tw5EiK2zsl4M9C5`
(her default "Compte principal").

## Fix
Update the listing's `stripe_account_id` to her active default account so future rent payments
are routed correctly via Stripe Connect `on_behalf_of`.

## Safety
- Only touches one row (the specific listing).
- The destination account is confirmed active with charges_enabled and payouts_enabled.
- No data is lost; the old orphaned account ID is simply replaced with the correct one.
*/

UPDATE listings
SET stripe_account_id = 'acct_1Tw5EiK2zsl4M9C5'
WHERE id = '674598c3-bcc9-4347-a138-778ae2367291'
  AND stripe_account_id = 'acct_1U3wcc2eLa0Xabjl';

/*
  # Fix anon SELECT policies blocked by is_admin()

  1. Problem
     - feature_carousel_images SELECT policy is scoped to `public` and calls is_admin().
     - listings SELECT policy "Annonces actives visibles publiquement" is scoped to `public` and calls is_admin().
     - anon does NOT have EXECUTE on is_admin(), so every anon request fails with
       "permission denied for function is_admin".

  2. Changes
     - feature_carousel_images: drop the `public` SELECT policy, create two separate policies:
       * anon: SELECT where is_active = true (no is_admin call)
       * authenticated: SELECT where is_active = true OR is_admin()
     - listings: drop the `public` SELECT policy, create two separate policies:
       * anon: SELECT where is_active = true (no is_admin call)
       * authenticated: SELECT where is_active = true OR landlord_id = auth.uid() OR is_admin()

  3. Security
     - anon can only read active (publicly visible) rows — same as before, minus the broken is_admin call.
     - authenticated users keep the same access: active rows, own rows, plus admin sees everything.
*/

-- feature_carousel_images
DROP POLICY IF EXISTS "Public views active, admins view all" ON feature_carousel_images;

CREATE POLICY "anon_select_active_features"
  ON feature_carousel_images FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "auth_select_features"
  ON feature_carousel_images FOR SELECT
  TO authenticated
  USING (is_active = true OR is_admin());

-- listings
DROP POLICY IF EXISTS "Annonces actives visibles publiquement" ON listings;

CREATE POLICY "anon_select_active_listings"
  ON listings FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "auth_select_listings"
  ON listings FOR SELECT
  TO authenticated
  USING (is_active = true OR landlord_id = auth.uid() OR is_admin());

