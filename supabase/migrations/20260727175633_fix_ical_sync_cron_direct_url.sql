/*
# Fix iCal sync cron job with direct URL

1. Scheduled Jobs
   - Drop the old cron job that used unavailable app.settings
   - Create a new cron job with the direct Supabase URL
   - Runs every 10 minutes to sync all external iCal feeds

2. Important Notes
   - The sync-all-calendars function is deployed without JWT verification
   - No authorization header needed since verify_jwt is disabled
*/

SELECT cron.unschedule('sync-ical-feeds-every-10min');

SELECT cron.schedule(
  'sync-ical-feeds-every-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bowqrkapnzvcbaciaplx.supabase.co/functions/v1/sync-all-calendars',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
