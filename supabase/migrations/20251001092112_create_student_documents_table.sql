/*
  # Créer le système de gestion des documents étudiants
  
  1. Nouvelle table
    - `student_documents` : stockage des documents des étudiants
      - `id` (uuid, primary key)
      - `student_id` (uuid, foreign key vers profiles)
      - `booking_id` (uuid, nullable, foreign key vers bookings)
      - `document_type` (text) : id_card_front, id_card_back, accommodation_certificate, insurance_certificate, lease_copy, inventory_copy
      - `file_url` (text) : URL du fichier dans le storage
      - `file_name` (text) : nom original du fichier
      - `uploaded_at` (timestamptz)
      - `status` (text) : pending, approved, rejected
      - `admin_notes` (text, nullable)
  
  2. Sécurité
    - Enable RLS sur student_documents
    - Les étudiants peuvent voir et uploader leurs propres documents
    - Les propriétaires peuvent voir les documents des étudiants qui ont réservé chez eux
  
  3. Storage
    - Créer un bucket pour les documents étudiants
    - Policies pour l'upload et la lecture sécurisée
*/

-- Créer la table des documents étudiants
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

-- Enable RLS
ALTER TABLE student_documents ENABLE ROW LEVEL SECURITY;

-- Policy : Les étudiants peuvent voir leurs propres documents
CREATE POLICY "Students can view own documents"
  ON student_documents
  FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

-- Policy : Les étudiants peuvent uploader leurs documents
CREATE POLICY "Students can upload own documents"
  ON student_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

-- Policy : Les étudiants peuvent mettre à jour leurs documents
CREATE POLICY "Students can update own documents"
  ON student_documents
  FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Policy : Les étudiants peuvent supprimer leurs documents
CREATE POLICY "Students can delete own documents"
  ON student_documents
  FOR DELETE
  TO authenticated
  USING (student_id = auth.uid());

-- Policy : Les propriétaires peuvent voir les documents des étudiants qui ont réservé
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

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_student_documents_student_id 
  ON student_documents(student_id);

CREATE INDEX IF NOT EXISTS idx_student_documents_booking_id 
  ON student_documents(booking_id);

CREATE INDEX IF NOT EXISTS idx_student_documents_type 
  ON student_documents(document_type);

-- Créer le bucket de storage pour les documents étudiants
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-documents', 'student-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policy storage : Les étudiants peuvent uploader leurs documents
CREATE POLICY "Students can upload their documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'student-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy storage : Les étudiants peuvent voir leurs documents
CREATE POLICY "Students can view their documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'student-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy storage : Les propriétaires peuvent voir les documents de leurs locataires
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

-- Policy storage : Les étudiants peuvent mettre à jour leurs documents
CREATE POLICY "Students can update their documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'student-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy storage : Les étudiants peuvent supprimer leurs documents
CREATE POLICY "Students can delete their documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'student-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );