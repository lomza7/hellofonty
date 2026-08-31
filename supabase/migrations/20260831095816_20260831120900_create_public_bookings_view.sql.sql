-- Phase 2: Create public_bookings view for availability calendar
-- The "Anyone can view booking dates for availability" policy exposes ALL booking columns
-- (including payment_amount, rent_amount, deposit_amount, platform_fee, student_id) to everyone.
-- This view exposes only the columns needed for the availability calendar.

CREATE OR REPLACE VIEW public_bookings AS
SELECT 
  id,
  listing_id,
  start_date,
  end_date,
  status
FROM bookings
WHERE status IN ('confirmed', 'pending');

GRANT SELECT ON public_bookings TO anon, authenticated;

-- Drop the permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view booking dates for availability" ON bookings;

-- Revoke SELECT from anon on bookings (they should use public_bookings view)
REVOKE SELECT ON bookings FROM anon;
