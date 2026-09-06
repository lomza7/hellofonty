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
