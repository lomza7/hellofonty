/*
  # Ajouter une politique d'insertion pour les notifications

  1. Modifications
    - Ajoute une politique INSERT pour permettre aux utilisateurs authentifiés de créer des notifications pour d'autres utilisateurs
    - Nécessaire pour que les étudiants puissent créer des notifications pour les propriétaires lors de l'annulation de demandes
  
  2. Sécurité
    - Permet uniquement aux utilisateurs authentifiés de créer des notifications
    - Les utilisateurs peuvent toujours uniquement voir et modifier leurs propres notifications
*/

-- Ajouter la politique INSERT pour les notifications
CREATE POLICY "Authenticated users can create notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
/*
  # Add GPS coordinates to listings

  1. Changes
    - Add `latitude` column to listings table (decimal type)
    - Add `longitude` column to listings table (decimal type)
    - Set default values for existing listings to Fontainebleau center
  
  2. Notes
    - Coordinates will be used to display listings on the interactive map
    - Latitude and longitude are optional fields
    - Default coordinates point to Fontainebleau center (48.4084, 2.7007)
*/

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

/*
  # Ajouter la vérification de téléphone par SMS
  
  1. Modifications
    - Ajouter `phone_verified` (booléen) aux profils pour suivre l'état de vérification
    - Ajouter `phone_verification_code` (texte) pour stocker le code de vérification temporaire
    - Ajouter `phone_verification_expires_at` (timestamp) pour l'expiration du code
    - Ajouter une table `phone_verification_attempts` pour limiter les tentatives
  
  2. Sécurité
    - Les codes de vérification expirent après 10 minutes
    - Maximum 5 tentatives par numéro de téléphone par heure
    - Les codes sont hachés avant stockage
  
  3. Tables
    - `phone_verification_attempts` : suivi des tentatives de vérification
*/

-- Ajouter les colonnes de vérification de téléphone au profil
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

-- Créer une table pour suivre les tentatives de vérification
CREATE TABLE IF NOT EXISTS phone_verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  attempted_at timestamptz DEFAULT now(),
  success boolean DEFAULT false,
  ip_address text
);

ALTER TABLE phone_verification_attempts ENABLE ROW LEVEL SECURITY;

-- Policy pour permettre l'insertion des tentatives
CREATE POLICY "Allow insert verification attempts"
  ON phone_verification_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy pour permettre la lecture de ses propres tentatives
CREATE POLICY "Users can read own attempts"
  ON phone_verification_attempts
  FOR SELECT
  TO authenticated
  USING (phone IN (SELECT phone FROM profiles WHERE id = auth.uid()));

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_phone_verification_attempts_phone 
  ON phone_verification_attempts(phone, attempted_at DESC);

-- Fonction pour nettoyer les anciennes tentatives (plus de 24h)
CREATE OR REPLACE FUNCTION cleanup_old_verification_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM phone_verification_attempts 
  WHERE attempted_at < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
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
/*
  # Créer le système de gestion des documents propriétaires
  
  1. Nouvelle table
    - `landlord_documents` : stockage des documents des propriétaires
      - `id` (uuid, primary key)
      - `landlord_id` (uuid, foreign key vers profiles)
      - `listing_id` (uuid, nullable, foreign key vers listings) : pour lier les docs signés à un logement spécifique
      - `document_type` (text) : 
        * Documents de vérification : id_card, kbis, property_tax
        * Documents signés par logement : lease_copy, inventory_copy
        * Assurances des locataires : tenant_insurance
      - `file_url` (text) : URL du fichier dans le storage
      - `file_name` (text) : nom original du fichier
      - `tenant_id` (uuid, nullable) : pour identifier le locataire concerné (utile pour les assurances)
      - `uploaded_at` (timestamptz)
      - `status` (text) : pending, approved, rejected
      - `admin_notes` (text, nullable)
  
  2. Sécurité
    - Enable RLS sur landlord_documents
    - Les propriétaires peuvent voir et uploader leurs propres documents
    - Les propriétaires peuvent voir les documents liés à leurs logements
    - Les étudiants peuvent voir certains documents du propriétaire (bail signé, état des lieux)
  
  3. Storage
    - Créer un bucket pour les documents propriétaires
    - Policies pour l'upload et la lecture sécurisée
*/

-- Créer la table des documents propriétaires
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

-- Enable RLS
ALTER TABLE landlord_documents ENABLE ROW LEVEL SECURITY;

-- Policy : Les propriétaires peuvent voir leurs propres documents
CREATE POLICY "Landlords can view own documents"
  ON landlord_documents
  FOR SELECT
  TO authenticated
  USING (landlord_id = auth.uid());

-- Policy : Les propriétaires peuvent uploader leurs documents
CREATE POLICY "Landlords can upload own documents"
  ON landlord_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (landlord_id = auth.uid());

-- Policy : Les propriétaires peuvent mettre à jour leurs documents
CREATE POLICY "Landlords can update own documents"
  ON landlord_documents
  FOR UPDATE
  TO authenticated
  USING (landlord_id = auth.uid())
  WITH CHECK (landlord_id = auth.uid());

-- Policy : Les propriétaires peuvent supprimer leurs documents
CREATE POLICY "Landlords can delete own documents"
  ON landlord_documents
  FOR DELETE
  TO authenticated
  USING (landlord_id = auth.uid());

-- Policy : Les étudiants peuvent voir les documents signés liés à leur réservation
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

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_landlord_documents_landlord_id 
  ON landlord_documents(landlord_id);

CREATE INDEX IF NOT EXISTS idx_landlord_documents_listing_id 
  ON landlord_documents(listing_id);

CREATE INDEX IF NOT EXISTS idx_landlord_documents_type 
  ON landlord_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_landlord_documents_tenant_id 
  ON landlord_documents(tenant_id);

-- Créer le bucket de storage pour les documents propriétaires
INSERT INTO storage.buckets (id, name, public)
VALUES ('landlord-documents', 'landlord-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policy storage : Les propriétaires peuvent uploader leurs documents
CREATE POLICY "Landlords can upload their documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'landlord-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy storage : Les propriétaires peuvent voir leurs documents
CREATE POLICY "Landlords can view their documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'landlord-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy storage : Les étudiants peuvent voir les documents signés de leurs propriétaires
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

-- Policy storage : Les propriétaires peuvent mettre à jour leurs documents
CREATE POLICY "Landlords can update their documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'landlord-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy storage : Les propriétaires peuvent supprimer leurs documents
CREATE POLICY "Landlords can delete their documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'landlord-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
