-- Phase 1: Fix rent_payments open write policies
-- The "System can update rent payments" policy had USING(true) WITH CHECK(true)
-- which allowed ANY authenticated user to modify ANY rent payment.
-- The "System can insert rent payments" policy had WITH CHECK(true)
-- which allowed ANY authenticated user to insert fake payments.
-- Triggers and cron use service_role which bypasses RLS, so these permissive policies are unnecessary.

DROP POLICY IF EXISTS "System can update rent payments" ON rent_payments;
DROP POLICY IF EXISTS "System can insert rent payments" ON rent_payments;

-- Keep the legitimate policies:
-- "Students can view own rent payments" (student_id = auth.uid())
-- "Landlords can view rent payments for their bookings" (landlord_id = auth.uid())
-- "Admins can view all rent payments" (role = admin)
-- "Admins can update rent payments" (role = admin)
-- "Managers can view rent payments for assigned listings"
-- "Managers can update rent payments for assigned listings"

-- Add a policy for students to UPDATE their own rent payments (e.g. auto_reminder_enabled toggle)
CREATE POLICY "Students can update own rent payments" ON rent_payments
  FOR UPDATE TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- Add a policy for landlords to UPDATE rent payments for their bookings
CREATE POLICY "Landlords can update rent payments for their bookings" ON rent_payments
  FOR UPDATE TO authenticated
  USING (auth.uid() = landlord_id)
  WITH CHECK (auth.uid() = landlord_id);
