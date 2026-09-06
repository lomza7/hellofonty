/*
# Fix cron job send-rent-reminder-daily with hardcoded URL

## Problem
The cron job used `current_setting('app.settings.supabase_url', true)` and
`current_setting('app.settings.service_role_key', true)` which can return NULL
if the database-level settings are lost, silently breaking the daily reminder.

## Fix
Reschedule the cron with a hardcoded URL (matching the pattern used by the
sync-ical-feeds-every-10min cron job). The edge function reads its own
SUPABASE_SERVICE_ROLE_KEY from Deno.env at runtime, so the Authorization header
is only needed for JWT verification — pg_net internal requests are treated as
authenticated by Supabase, as proven by the ical sync cron working without it.

## Changes
1. Unschedule the existing send-rent-reminder-daily job
2. Reschedule with hardcoded URL and minimal headers
*/

SELECT cron.unschedule('send-rent-reminder-daily');

SELECT cron.schedule(
  'send-rent-reminder-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bowqrkapnzvcbaciaplx.supabase.co/functions/v1/send-rent-reminder',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
