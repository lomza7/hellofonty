/*
# Allow AVIF format in images bucket

1. Changes
   - Update the `images` storage bucket to include `image/avif` in allowed_mime_types.
   - This prevents "mime type image/avif is not supported" errors when uploading
     photos imported from Airbnb (which often serves AVIF images).
2. Notes
   - No data is lost; this only modifies bucket metadata.
   - The bucket already accepts jpeg, png, webp, gif.
*/

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif'
]
WHERE id = 'images';
