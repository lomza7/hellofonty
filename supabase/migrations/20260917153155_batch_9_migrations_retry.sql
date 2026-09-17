-- Retry batch 9: Fix carousel RLS, student features, iCal sync

DROP POLICY IF EXISTS "Anyone can view active features" ON feature_carousel_images;
DROP POLICY IF EXISTS "Admins can view all features" ON feature_carousel_images;

DROP POLICY IF EXISTS "Public views active, admins view all" ON feature_carousel_images;
CREATE POLICY "Public views active, admins view all"
  ON feature_carousel_images
  FOR SELECT
  USING (
    is_active = true 
    OR 
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

INSERT INTO feature_carousel_images (feature_key, image_url, display_order, is_active) VALUES
  ('students.search', 'https://images.pexels.com/photos/1370704/pexels-photo-1370704.jpeg', 10, true),
  ('students.booking', 'https://images.pexels.com/photos/5717546/pexels-photo-5717546.jpeg', 11, true),
  ('students.verified', 'https://images.pexels.com/photos/5668838/pexels-photo-5668838.jpeg', 12, true),
  ('students.documents', 'https://images.pexels.com/photos/6476589/pexels-photo-6476589.jpeg', 13, true),
  ('students.messaging', 'https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg', 14, true),
  ('students.reviews', 'https://images.pexels.com/photos/7189028/pexels-photo-7189028.jpeg', 15, true),
  ('students.favorites', 'https://images.pexels.com/photos/4050315/pexels-photo-4050315.jpeg', 16, true),
  ('students.profile', 'https://images.pexels.com/photos/3760263/pexels-photo-3760263.jpeg', 17, true)
ON CONFLICT (feature_key) DO NOTHING;

INSERT INTO feature_carousel_images (feature_key, image_url, display_order, is_active) VALUES
  ('students.access', 'https://images.pexels.com/photos/279810/pexels-photo-279810.jpeg', 18, true),
  ('students.community', 'https://images.pexels.com/photos/1595385/pexels-photo-1595385.jpeg', 19, true),
  ('students.free', 'https://images.pexels.com/photos/259027/pexels-photo-259027.jpeg', 20, true)
ON CONFLICT (feature_key) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_carousel_images' AND column_name = 'title_fr'
  ) THEN
    ALTER TABLE feature_carousel_images ADD COLUMN title_fr text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_carousel_images' AND column_name = 'title_en'
  ) THEN
    ALTER TABLE feature_carousel_images ADD COLUMN title_en text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_carousel_images' AND column_name = 'description_fr'
  ) THEN
    ALTER TABLE feature_carousel_images ADD COLUMN description_fr text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_carousel_images' AND column_name = 'description_en'
  ) THEN
    ALTER TABLE feature_carousel_images ADD COLUMN description_en text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ical_sync_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  created_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz,
  access_count integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS external_ical_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  feed_url text NOT NULL,
  feed_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_synced_at timestamptz,
  sync_status text DEFAULT 'active' CHECK (sync_status IN ('active', 'error', 'disabled')),
  error_message text
);

CREATE TABLE IF NOT EXISTS imported_blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  feed_id uuid NOT NULL REFERENCES external_ical_feeds(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  event_uid text NOT NULL,
  summary text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_ical_sync_tokens_listing ON ical_sync_tokens(listing_id);
CREATE INDEX IF NOT EXISTS idx_ical_sync_tokens_token ON ical_sync_tokens(token);
CREATE INDEX IF NOT EXISTS idx_external_ical_feeds_listing ON external_ical_feeds(listing_id);
CREATE INDEX IF NOT EXISTS idx_imported_blocked_dates_listing ON imported_blocked_dates(listing_id);
CREATE INDEX IF NOT EXISTS idx_imported_blocked_dates_feed ON imported_blocked_dates(feed_id);
CREATE INDEX IF NOT EXISTS idx_imported_blocked_dates_uid ON imported_blocked_dates(event_uid);
CREATE INDEX IF NOT EXISTS idx_imported_blocked_dates_dates ON imported_blocked_dates(listing_id, start_date, end_date);

ALTER TABLE ical_sync_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_ical_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE imported_blocked_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own sync tokens" ON ical_sync_tokens;
CREATE POLICY "Owners can view own sync tokens"
  ON ical_sync_tokens FOR SELECT
  TO authenticated
  USING (listing_id IN (SELECT id FROM listings WHERE landlord_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can create sync tokens" ON ical_sync_tokens;
CREATE POLICY "Owners can create sync tokens"
  ON ical_sync_tokens FOR INSERT
  TO authenticated
  WITH CHECK (listing_id IN (SELECT id FROM listings WHERE landlord_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can delete own sync tokens" ON ical_sync_tokens;
CREATE POLICY "Owners can delete own sync tokens"
  ON ical_sync_tokens FOR DELETE
  TO authenticated
  USING (listing_id IN (SELECT id FROM listings WHERE landlord_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can update own sync tokens" ON ical_sync_tokens;
CREATE POLICY "Owners can update own sync tokens"
  ON ical_sync_tokens FOR UPDATE
  TO authenticated
  USING (listing_id IN (SELECT id FROM listings WHERE landlord_id = auth.uid()))
  WITH CHECK (listing_id IN (SELECT id FROM listings WHERE landlord_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can view own ical feeds" ON external_ical_feeds;
CREATE POLICY "Owners can view own ical feeds"
  ON external_ical_feeds FOR SELECT
  TO authenticated
  USING (listing_id IN (SELECT id FROM listings WHERE landlord_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can create ical feeds" ON external_ical_feeds;
CREATE POLICY "Owners can create ical feeds"
  ON external_ical_feeds FOR INSERT
  TO authenticated
  WITH CHECK (listing_id IN (SELECT id FROM listings WHERE landlord_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can update own ical feeds" ON external_ical_feeds;
CREATE POLICY "Owners can update own ical feeds"
  ON external_ical_feeds FOR UPDATE
  TO authenticated
  USING (listing_id IN (SELECT id FROM listings WHERE landlord_id = auth.uid()))
  WITH CHECK (listing_id IN (SELECT id FROM listings WHERE landlord_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can delete own ical feeds" ON external_ical_feeds;
CREATE POLICY "Owners can delete own ical feeds"
  ON external_ical_feeds FOR DELETE
  TO authenticated
  USING (listing_id IN (SELECT id FROM listings WHERE landlord_id = auth.uid()));

DROP POLICY IF EXISTS "Anyone can view imported blocked dates" ON imported_blocked_dates;
CREATE POLICY "Anyone can view imported blocked dates"
  ON imported_blocked_dates FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "System can insert imported blocked dates" ON imported_blocked_dates;
CREATE POLICY "System can insert imported blocked dates"
  ON imported_blocked_dates FOR INSERT
  TO authenticated
  WITH CHECK (listing_id IN (SELECT id FROM listings WHERE landlord_id = auth.uid()));

DROP POLICY IF EXISTS "System can update imported blocked dates" ON imported_blocked_dates;
CREATE POLICY "System can update imported blocked dates"
  ON imported_blocked_dates FOR UPDATE
  TO authenticated
  USING (listing_id IN (SELECT id FROM listings WHERE landlord_id = auth.uid()))
  WITH CHECK (listing_id IN (SELECT id FROM listings WHERE landlord_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can delete imported blocked dates" ON imported_blocked_dates;
CREATE POLICY "Owners can delete imported blocked dates"
  ON imported_blocked_dates FOR DELETE
  TO authenticated
  USING (listing_id IN (SELECT id FROM listings WHERE landlord_id = auth.uid()));

CREATE OR REPLACE FUNCTION cleanup_old_imported_dates()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM imported_blocked_dates
  WHERE end_date < CURRENT_DATE - INTERVAL '1 year';
END;
$$;