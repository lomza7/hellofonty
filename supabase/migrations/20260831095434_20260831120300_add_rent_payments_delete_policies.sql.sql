-- Add DELETE policies for rent_payments
-- Landlords delete rent_payments when cancelling a booking (from Leases.tsx and MyBookingRequests.tsx)
CREATE POLICY "Landlords can delete rent payments for their bookings" ON rent_payments
  FOR DELETE TO authenticated
  USING (auth.uid() = landlord_id);

-- Admins can also delete rent payments
CREATE POLICY "Admins can delete rent payments" ON rent_payments
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));
