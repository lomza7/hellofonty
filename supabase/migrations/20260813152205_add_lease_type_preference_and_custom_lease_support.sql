/*
# Add lease type preference and custom lease support

1. New Columns
- `profiles.preferred_lease_type` (text, default 'hellofonty') : Stores the landlord's choice between
  the HelloFonty model lease ('hellofonty') and their own custom lease document ('custom').
- `leases.lease_source` (text, default 'hellofonty') : Distinguishes leases generated from the
  HelloFonty template ('hellofonty') from those where the landlord uploaded their own document ('custom').

2. New Storage Bucket
- `lease-documents` (private) : Stores custom lease documents uploaded by landlords (PDF/Word).
  Only the landlord who owns the lease and the tenant linked to it can access the files.

3. Security
- RLS policies on `lease-documents` bucket: landlord (owner of the lease) and tenant can read;
  landlord can upload/update/delete their own lease documents.
- No changes to existing table RLS — existing policies remain intact.

4. Important Notes
- The `preferred_lease_type` column defaults to 'hellofonty' so existing landlords keep the current behavior.
- The `lease_source` column defaults to 'hellofonty' so existing leases are treated as HelloFonty model leases.
- The storage bucket is private (not public) to protect sensitive lease documents.
*/

-- Add preferred_lease_type to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'preferred_lease_type'
  ) THEN
    ALTER TABLE profiles ADD COLUMN preferred_lease_type text NOT NULL DEFAULT 'hellofonty';
  END IF;
END $$;

-- Add lease_source to leases
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leases' AND column_name = 'lease_source'
  ) THEN
    ALTER TABLE leases ADD COLUMN lease_source text NOT NULL DEFAULT 'hellofonty';
  END IF;
END $$;

-- Create lease-documents storage bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lease-documents',
  'lease-documents',
  false,
  20971520, -- 20 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for lease-documents bucket
-- Read: landlord who owns the lease or tenant linked to the lease
DROP POLICY IF EXISTS "Landlords can read their lease documents" ON storage.objects;
CREATE POLICY "Landlords can read their lease documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'lease-documents'
    AND EXISTS (
      SELECT 1 FROM leases
      WHERE leases.landlord_id = auth.uid()
      AND leases.document_url = name
    )
  );

DROP POLICY IF EXISTS "Tenants can read their lease documents" ON storage.objects;
CREATE POLICY "Tenants can read their lease documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'lease-documents'
    AND EXISTS (
      SELECT 1 FROM leases
      WHERE leases.tenant_id = auth.uid()
      AND leases.document_url = name
    )
  );

-- Upload: landlord can upload files to their own folder
DROP POLICY IF EXISTS "Landlords can upload lease documents" ON storage.objects;
CREATE POLICY "Landlords can upload lease documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'lease-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update: landlord can update their own files
DROP POLICY IF EXISTS "Landlords can update their lease documents" ON storage.objects;
CREATE POLICY "Landlords can update their lease documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'lease-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'lease-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete: landlord can delete their own files
DROP POLICY IF EXISTS "Landlords can delete their lease documents" ON storage.objects;
CREATE POLICY "Landlords can delete their lease documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'lease-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
