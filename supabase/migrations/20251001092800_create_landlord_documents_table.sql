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