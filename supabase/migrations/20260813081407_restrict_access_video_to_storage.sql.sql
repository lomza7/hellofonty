-- Add a CHECK constraint to access_guides.access_video to reject YouTube/video streaming URLs
-- Only allow Supabase storage URLs or empty/null values

ALTER TABLE access_guides
  DROP CONSTRAINT IF EXISTS access_video_must_be_storage_url;

ALTER TABLE access_guides
  ADD CONSTRAINT access_video_must_be_storage_url CHECK (
    access_video IS NULL
    OR access_video = ''
    OR (
      access_video NOT ILIKE '%youtube.com%'
      AND access_video NOT ILIKE '%youtu.be%'
      AND access_video NOT ILIKE '%vimeo.com%'
      AND access_video NOT ILIKE '%dailymotion.com%'
      AND access_video NOT ILIKE '%twitch.tv%'
      AND access_video NOT ILIKE '%facebook.com/%/videos%'
    )
  );