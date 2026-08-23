/*
# Automatic monthly landlord subscription charges via pg_cron

## Purpose
Schedules a monthly job that calls the `charge-landlord-subscriptions-cron`
edge function. This function iterates over all landlords with an active
Premium subscription, verifies they still have an active lease (end_date in
the future), and charges 59 EUR directly on their Stripe Connect account.
If the lease has ended, the subscription is automatically downgraded to free.

## Changes
1. Creates a PL/pgSQL function `charge_landlord_subscriptions()` that calls
   the edge function via `net.http_post` (pg_net extension).
2. Schedules it with `pg_cron` on the 1st of every month at 02:00 UTC.
3. Grants execution to the service role.

## Security
- The function runs with SECURITY DEFINER as the owner (postgres).
- It only makes an HTTP call to an internal edge function — no data is exposed.
*/

-- Ensure pg_net extension is available for HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.charge_landlord_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_function_url text;
  v_service_role_key text;
BEGIN
  v_function_url := current_setting('app.supabase_url', true) || '/functions/v1/charge-landlord-subscriptions-cron';
  v_service_role_key := current_setting('app.service_role_key', true);

  IF v_service_role_key IS NULL OR v_service_role_key = '' THEN
    RAISE NOTICE 'Service role key not configured, skipping subscription charges';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := '{}'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.charge_landlord_subscriptions() TO service_role;

-- Schedule the job on the 1st of every month at 02:00 UTC (idempotent)
DO $_$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'charge_landlord_subscriptions') THEN
    PERFORM cron.unschedule('charge_landlord_subscriptions');
  END IF;
  PERFORM cron.schedule(
    'charge_landlord_subscriptions',
    '0 2 1 * *',
    'SELECT public.charge_landlord_subscriptions();'
  );
END $_$;
