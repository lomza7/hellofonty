/*
# Auto-expire pending bookings past their payment deadline

## Purpose
Bookings with `payment_status = 'pending'` whose `payment_deadline` has passed
were staying stuck in pending forever, because expiration only happened when
a student tried to pay (inside the edge function). This migration adds a
scheduled job that runs every 10 minutes and marks those bookings as expired.

## Changes
1. Creates a PL/pgSQL function `expire_overdue_bookings()` that updates
   bookings set to `payment_status = 'expired'` where the deadline has passed.
2. Schedules it with `pg_cron` every 10 minutes.
3. Grants execution to the service role.

## Security
- The function runs with SECURITY DEFINER as the owner (postgres), so it can
  update bookings regardless of RLS. This is safe because it only performs a
  status transition (pending -> expired) and does not expose data.
- No new tables, no new RLS policies.
*/

CREATE OR REPLACE FUNCTION public.expire_overdue_bookings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.bookings
  SET payment_status = 'expired',
      updated_at = now()
  WHERE payment_status = 'pending'
    AND payment_deadline IS NOT NULL
    AND payment_deadline < now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_overdue_bookings() TO service_role;

-- Schedule the job every 10 minutes (idempotent: drop existing first)
DO $_$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire_overdue_bookings') THEN
    PERFORM cron.unschedule('expire_overdue_bookings');
  END IF;
  PERFORM cron.schedule(
    'expire_overdue_bookings',
    '*/10 * * * *',
    'SELECT public.expire_overdue_bookings();'
  );
END $_$;
