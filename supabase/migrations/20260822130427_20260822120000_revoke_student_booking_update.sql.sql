/*
# Revoke student booking update permission

## Context
Students should NOT be able to cancel or modify their own bookings directly.
Only landlords, managers, and admins can update booking status (e.g. confirm,
cancel). Students must contact hellofonty support to request a cancellation.

## Changes
- Drop the "Students can update own bookings" policy from the `bookings` table.
  This removes the ability for a student to UPDATE their own booking rows,
  preventing them from changing the status to 'cancelled' via the API even
  though the UI no longer exposes a cancel button.

## Security
- No new policies created.
- Existing UPDATE policies for landlords, managers, and admins remain intact.
- Students retain SELECT (view own bookings) and INSERT (create bookings) access.
*/

DROP POLICY IF EXISTS "Students can update own bookings" ON public.bookings;
