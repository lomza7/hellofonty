/*
# Add unique constraint on imported_blocked_dates.event_uid

1. Modified Tables
   - `imported_blocked_dates`
     - Add unique constraint on `event_uid` to support upsert operations during iCal sync

2. Important Notes
   - Removes the non-unique index first to avoid conflicts
   - Creates a unique index to enable ON CONFLICT upsert
*/

DROP INDEX IF EXISTS idx_imported_blocked_dates_uid;
CREATE UNIQUE INDEX IF NOT EXISTS idx_imported_blocked_dates_event_uid_unique
  ON imported_blocked_dates (event_uid);
