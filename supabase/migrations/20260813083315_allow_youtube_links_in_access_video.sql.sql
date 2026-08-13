-- Remove the constraint that blocked YouTube/streaming URLs on access_guides.access_video
-- We now allow YouTube links in the access guide video section.

ALTER TABLE access_guides
  DROP CONSTRAINT IF EXISTS access_video_must_be_storage_url;