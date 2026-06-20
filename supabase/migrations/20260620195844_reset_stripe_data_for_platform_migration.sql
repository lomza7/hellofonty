/*
  # Reset Stripe data for platform account migration

  All existing Stripe data was linked to the old personal account.
  The platform is switching to a new dedicated Stripe Connect account.
  Existing landlords will need to redo their Stripe onboarding.

  1. Reset all landlord Stripe Connect data in profiles
  2. Clear stripe_customers table (tied to old account)
  3. Reset Stripe onboarding tasks back to pending
  4. Clear stripe_subscriptions (no active subs confirmed)
  5. Add a flag column to track who needs migration notice
*/

-- Add a flag to know which landlords had previously completed Stripe setup
-- so we can show them a migration notice
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_migration_needed boolean DEFAULT false;

-- Mark landlords who had a Stripe account as needing migration notice
UPDATE profiles
SET stripe_migration_needed = true
WHERE stripe_account_id IS NOT NULL;

-- Reset all Stripe Connect fields on profiles
UPDATE profiles
SET
  stripe_account_id = NULL,
  stripe_onboarding_status = 'not_connected',
  stripe_charges_enabled = false,
  stripe_payouts_enabled = false,
  stripe_details_submitted = false,
  stripe_onboarding_updated_at = NULL
WHERE stripe_account_id IS NOT NULL;

-- Reset Stripe onboarding tasks back to pending for all landlords
UPDATE tasks
SET
  status = 'pending',
  completed_at = NULL
WHERE title = 'Configurer votre compte de paiement Stripe'
AND status = 'completed';

-- Clear stripe_customers (all linked to old account)
DELETE FROM stripe_customers;

-- Clear stripe_subscriptions (no active subs)
DELETE FROM stripe_subscriptions;

-- Clear stripe_orders (linked to old account)
DELETE FROM stripe_orders;