-- Add unique constraint on booking_id for upsert support
CREATE UNIQUE INDEX IF NOT EXISTS idx_deposit_transactions_booking_id_unique
  ON deposit_transactions(booking_id);