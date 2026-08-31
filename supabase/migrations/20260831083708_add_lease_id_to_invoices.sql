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
