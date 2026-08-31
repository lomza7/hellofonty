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
