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
