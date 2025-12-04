/*
  # Add video URL support to listings

  1. Changes
    - Add `video_url` column to `listings` table to store YouTube or other video platform URLs
    - Column is optional (nullable) to maintain backward compatibility
  
  2. Notes
    - Supports any video platform URL (YouTube, Vimeo, etc.)
    - Property owners can showcase their property with a video tour
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'video_url'
  ) THEN
    ALTER TABLE listings ADD COLUMN video_url text;
  END IF;
END $$;