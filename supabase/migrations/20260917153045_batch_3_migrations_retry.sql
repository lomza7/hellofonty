-- Retry batch 3: notifications INSERT policy, GPS coords, phone verification, student_documents, landlord_documents

DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;
CREATE POLICY "Authenticated users can create notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE listings ADD COLUMN latitude decimal(10, 8) DEFAULT 48.4084;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE listings ADD COLUMN longitude decimal(11, 8) DEFAULT 2.7007;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'phone_verified'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone_verified boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'phone_verification_code'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone_verification_code text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'phone_verification_expires_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone_verification_expires_at timestamptz;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS phone_verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  attempted_at timestamptz DEFAULT now(),
  success boolean DEFAULT false,
  ip_address text
);

ALTER TABLE phone_verification_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow insert verification attempts" ON phone_verification_attempts;
CREATE POLICY "Allow insert verification attempts"
  ON phone_verification_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can read own attempts" ON phone_verification_attempts;
CREATE POLICY "Users can read own attempts"
  ON phone_verification_attempts
  FOR SELECT
  TO authenticated
  USING (phone IN (SELECT phone FROM profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_phone_verification_attempts_phone 
  ON phone_verification_attempts(phone, attempted_at DESC);

CREATE OR REPLACE FUNCTION cleanup_old_verification_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM phone_verification_attempts 
  WHERE attempted_at < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS student_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  document_type text NOT NULL CHECK (document_type IN (
    'id_card_front',
    'id_card_back', 
    'accommodation_certificate',
    'insurance_certificate',
    'lease_copy',
    'inventory_copy'
  )),
  file_url text NOT NULL,
  file_name text NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE student_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own documents" ON student_documents;
CREATE POLICY "Students can view own documents"
  ON student_documents
  FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can upload own documents" ON student_documents;
CREATE POLICY "Students can upload own documents"
  ON student_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can update own documents" ON student_documents;
CREATE POLICY "Students can update own documents"
  ON student_documents
  FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can delete own documents" ON student_documents;
CREATE POLICY "Students can delete own documents"
  ON student_documents
  FOR DELETE
  TO authenticated
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Landlords can view documents of their tenants" ON student_documents;
CREATE POLICY "Landlords can view documents of their tenants"
  ON student_documents
  FOR SELECT
  TO authenticated
  USING (
    booking_id IN (
      SELECT b.id FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE l.landlord_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_student_documents_student_id 
  ON student_documents(student_id);
CREATE INDEX IF NOT EXISTS idx_student_documents_booking_id 
  ON student_documents(booking_id);
CREATE INDEX IF NOT EXISTS idx_student_documents_type 
  ON student_documents(document_type);

INSERT INTO storage.buckets (id, name, public)
VALUES ('student-documents', 'student-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Students can upload their documents" ON storage.objects;
CREATE POLICY "Students can upload their documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'student-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Students can view their documents" ON storage.objects;
CREATE POLICY "Students can view their documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'student-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Landlords can view tenant documents" ON storage.objects;
CREATE POLICY "Landlords can view tenant documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'student-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT b.student_id::text
      FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE l.landlord_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can update their documents" ON storage.objects;
CREATE POLICY "Students can update their documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'student-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Students can delete their documents" ON storage.objects;
CREATE POLICY "Students can delete their documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'student-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE TABLE IF NOT EXISTS landlord_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN (
    'id_card',
    'kbis',
    'property_tax',
    'lease_copy',
    'inventory_copy',
    'tenant_insurance'
  )),
  file_url text NOT NULL,
  file_name text NOT NULL,
  tenant_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE landlord_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Landlords can view own documents" ON landlord_documents;
CREATE POLICY "Landlords can view own documents"
  ON landlord_documents
  FOR SELECT
  TO authenticated
  USING (landlord_id = auth.uid());

DROP POLICY IF EXISTS "Landlords can upload own documents" ON landlord_documents;
CREATE POLICY "Landlords can upload own documents"
  ON landlord_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (landlord_id = auth.uid());

DROP POLICY IF EXISTS "Landlords can update own documents" ON landlord_documents;
CREATE POLICY "Landlords can update own documents"
  ON landlord_documents
  FOR UPDATE
  TO authenticated
  USING (landlord_id = auth.uid())
  WITH CHECK (landlord_id = auth.uid());

DROP POLICY IF EXISTS "Landlords can delete own documents" ON landlord_documents;
CREATE POLICY "Landlords can delete own documents"
  ON landlord_documents
  FOR DELETE
  TO authenticated
  USING (landlord_id = auth.uid());

DROP POLICY IF EXISTS "Tenants can view signed documents for their bookings" ON landlord_documents;
CREATE POLICY "Tenants can view signed documents for their bookings"
  ON landlord_documents
  FOR SELECT
  TO authenticated
  USING (
    document_type IN ('lease_copy', 'inventory_copy') AND
    listing_id IN (
      SELECT b.listing_id FROM bookings b
      WHERE b.student_id = auth.uid()
      AND b.status = 'approved'
    )
  );

CREATE INDEX IF NOT EXISTS idx_landlord_documents_landlord_id 
  ON landlord_documents(landlord_id);
CREATE INDEX IF NOT EXISTS idx_landlord_documents_listing_id 
  ON landlord_documents(listing_id);
CREATE INDEX IF NOT EXISTS idx_landlord_documents_type 
  ON landlord_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_landlord_documents_tenant_id 
  ON landlord_documents(tenant_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('landlord-documents', 'landlord-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Landlords can upload their documents" ON storage.objects;
CREATE POLICY "Landlords can upload their documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'landlord-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Landlords can view their documents" ON storage.objects;
CREATE POLICY "Landlords can view their documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'landlord-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Tenants can view landlord signed documents" ON storage.objects;
CREATE POLICY "Tenants can view landlord signed documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'landlord-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT l.landlord_id::text
      FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE b.student_id = auth.uid()
      AND b.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Landlords can update their documents" ON storage.objects;
CREATE POLICY "Landlords can update their documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'landlord-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Landlords can delete their documents" ON storage.objects;
CREATE POLICY "Landlords can delete their documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'landlord-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );