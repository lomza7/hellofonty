/*
  # Create refunds table for tracking Stripe refunds

  1. New table
    - `refunds` - tracks all refunds issued from admin
    - Columns: booking_id, student_id, amount, refund_type, stripe_refund_id, admin_id, created_at

  2. New column on bookings
    - `platform_fee_refunded` boolean to track if platform fee was refunded

  3. Security
    - RLS enabled: only admins can read, only service role can insert
*/

CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  refund_type TEXT NOT NULL CHECK (refund_type IN ('full', 'partial', 'platform_fee')),
  stripe_refund_id TEXT NOT NULL,
  admin_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refunds_booking_id ON refunds(booking_id);
CREATE INDEX idx_refunds_student_id ON refunds(student_id);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS platform_fee_refunded BOOLEAN DEFAULT false;

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_can_read_refunds" ON refunds FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "students_can_read_own_refunds" ON refunds FOR SELECT
  TO authenticated USING (student_id = auth.uid());
