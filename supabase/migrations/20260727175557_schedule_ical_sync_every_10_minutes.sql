/*
# Enable pg_cron and pg_net, schedule iCal sync every 10 minutes

1. Extensions
   - Enable `pg_cron` for scheduled jobs
   - Enable `pg_net` for HTTP requests from the database

2. Scheduled Jobs
   - Create a cron job that calls the `sync-all-calendars` edge function every 10 minutes
   - This ensures external iCal feeds (e.g. Lodgify) are regularly imported

3. Important Notes
   - The edge function is deployed with verify_jwt=false so the cron can call it
   - The function itself uses the service role key internally
   - Security relies on the function not exposing sensitive data (it only syncs calendars)
*/

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('sync-ical-feeds-every-10min')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-ical-feeds-every-10min'
);

SELECT cron.schedule(
  'sync-ical-feeds-every-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/sync-all-calendars',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
