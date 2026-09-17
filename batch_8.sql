/*
  # Mise à jour du bucket images pour supporter les vidéos

  1. Modifications
    - Ajoute les types MIME vidéo au bucket 'images' existant
    - Augmente la limite de taille pour supporter les vidéos (100 MB)
    - Les vidéos supportées : mp4, webm, mov, avi

  2. Sécurité
    - Les politiques existantes restent inchangées
    - Les utilisateurs authentifiés peuvent uploader des vidéos
    - Les vidéos sont publiques comme les images
*/

-- Mettre à jour le bucket images pour accepter les vidéos et augmenter la taille
UPDATE storage.buckets
SET 
  allowed_mime_types = ARRAY[
    'image/jpeg', 
    'image/png', 
    'image/webp', 
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo'
  ],
  file_size_limit = 104857600
WHERE id = 'images';
/*
  # Ajout du token de partage pour les guides d'accès

  1. Modifications
    - Ajout de la colonne `share_token` à la table `access_guides`
      - Type: text unique
      - Permet de générer des liens partageables publics
      - Index pour améliorer les performances de recherche
    
  2. Sécurité
    - Politique publique en lecture pour les guides partagés via token
*/

-- Ajouter la colonne share_token
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'access_guides' AND column_name = 'share_token'
  ) THEN
    ALTER TABLE access_guides ADD COLUMN share_token text UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_access_guides_share_token ON access_guides(share_token);
  END IF;
END $$;

-- Politique pour permettre la lecture publique via token
CREATE POLICY "Anyone can view access guide with valid token"
  ON access_guides
  FOR SELECT
  USING (share_token IS NOT NULL);

/*
  # Création du système de baux (Leases)

  1. Nouvelle table : `leases`
    - `id` (uuid, primary key) - Identifiant unique du bail
    - `listing_id` (uuid, foreign key) - Référence au logement
    - `landlord_id` (uuid, foreign key) - Référence au propriétaire
    - `tenant_id` (uuid, foreign key) - Référence au locataire
    - `start_date` (date) - Date de début du bail
    - `end_date` (date) - Date de fin du bail
    - `monthly_rent` (decimal) - Montant du loyer mensuel
    - `security_deposit` (decimal) - Montant de la caution
    - `charges` (decimal) - Montant des charges
    - `lease_type` (text) - Type de bail (furnished, unfurnished, student, etc.)
    - `status` (text) - Statut (draft, pending_signature, signed, active, terminated, cancelled)
    - `document_url` (text) - URL du document PDF généré
    - `landlord_signature` (jsonb) - Données de signature du propriétaire
    - `tenant_signature` (jsonb) - Données de signature du locataire
    - `signature_request_id` (text) - ID de la demande de signature (API externe)
    - `terms_and_conditions` (text) - Clauses particulières du bail
    - `inventory_included` (boolean) - Si un état des lieux est inclus
    - `created_at` (timestamptz) - Date de création
    - `updated_at` (timestamptz) - Date de mise à jour
    - `signed_at` (timestamptz) - Date de signature complète

  2. Sécurité
    - Enable RLS sur la table `leases`
    - Les propriétaires peuvent créer, lire et modifier leurs baux
    - Les locataires peuvent lire et signer leurs baux
    - Les admins peuvent tout faire
*/

-- Création de la table leases
CREATE TABLE IF NOT EXISTS leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  landlord_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  monthly_rent decimal(10, 2) NOT NULL DEFAULT 0,
  security_deposit decimal(10, 2) NOT NULL DEFAULT 0,
  charges decimal(10, 2) DEFAULT 0,
  lease_type text NOT NULL DEFAULT 'furnished',
  status text NOT NULL DEFAULT 'draft',
  document_url text,
  landlord_signature jsonb,
  tenant_signature jsonb,
  signature_request_id text,
  terms_and_conditions text,
  inventory_included boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  signed_at timestamptz,
  CONSTRAINT valid_dates CHECK (end_date > start_date),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'pending_signature', 'signed', 'active', 'terminated', 'cancelled'))
);

-- Enable RLS
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;

-- Policy: Les propriétaires peuvent voir leurs baux
CREATE POLICY "Landlords can view own leases"
  ON leases FOR SELECT
  TO authenticated
  USING (
    landlord_id = auth.uid()
  );

-- Policy: Les locataires peuvent voir leurs baux
CREATE POLICY "Tenants can view their leases"
  ON leases FOR SELECT
  TO authenticated
  USING (
    tenant_id = auth.uid()
  );

-- Policy: Les propriétaires peuvent créer des baux
CREATE POLICY "Landlords can create leases"
  ON leases FOR INSERT
  TO authenticated
  WITH CHECK (
    landlord_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'landlord'
    )
  );

-- Policy: Les propriétaires peuvent modifier leurs baux non signés
CREATE POLICY "Landlords can update own draft leases"
  ON leases FOR UPDATE
  TO authenticated
  USING (
    landlord_id = auth.uid() AND
    status IN ('draft', 'pending_signature')
  )
  WITH CHECK (
    landlord_id = auth.uid()
  );

-- Policy: Les locataires peuvent signer leurs baux
CREATE POLICY "Tenants can sign their leases"
  ON leases FOR UPDATE
  TO authenticated
  USING (
    tenant_id = auth.uid() AND
    status = 'pending_signature'
  )
  WITH CHECK (
    tenant_id = auth.uid()
  );

-- Policy: Les admins peuvent tout faire
CREATE POLICY "Admins can do everything with leases"
  ON leases FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Les propriétaires peuvent supprimer leurs baux brouillons
CREATE POLICY "Landlords can delete draft leases"
  ON leases FOR DELETE
  TO authenticated
  USING (
    landlord_id = auth.uid() AND
    status = 'draft'
  );

-- Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_leases_landlord ON leases(landlord_id);
CREATE INDEX IF NOT EXISTS idx_leases_tenant ON leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leases_listing ON leases(listing_id);
CREATE INDEX IF NOT EXISTS idx_leases_status ON leases(status);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_leases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at
DROP TRIGGER IF EXISTS update_leases_updated_at_trigger ON leases;
CREATE TRIGGER update_leases_updated_at_trigger
  BEFORE UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION update_leases_updated_at();

/*
  # Ajouter booking_id à la table leases

  1. Modifications
    - Ajoute colonne `booking_id` (uuid, nullable, foreign key vers bookings)
    - Crée une contrainte unique sur booking_id pour éviter les doublons
    - Crée un index pour améliorer les performances

  2. Notes
    - booking_id est nullable car certains baux peuvent être créés sans réservation
    - La contrainte unique empêche qu'une même réservation ait plusieurs baux
*/

-- Ajouter la colonne booking_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leases' AND column_name = 'booking_id'
  ) THEN
    ALTER TABLE leases ADD COLUMN booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Créer une contrainte unique sur booking_id (ignorer les NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_booking_per_lease'
  ) THEN
    ALTER TABLE leases ADD CONSTRAINT unique_booking_per_lease UNIQUE (booking_id);
  END IF;
END $$;

-- Créer un index sur booking_id
CREATE INDEX IF NOT EXISTS idx_leases_booking ON leases(booking_id);

/*
  # Create feature carousel images table

  1. New Tables
    - `feature_carousel_images`
      - `id` (uuid, primary key)
      - `feature_key` (text) - Unique identifier for each feature (e.g., 'landlords.lease', 'students.search')
      - `image_url` (text) - URL of the image
      - `display_order` (integer) - Order in which the feature appears
      - `is_active` (boolean) - Whether the feature is currently active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `feature_carousel_images` table
    - Add policy for public read access (anyone can view features)
    - Add policy for admin write access (only admins can modify)

  3. Initial Data
    - Populate table with default feature images for landlords
*/

-- Create the table
CREATE TABLE IF NOT EXISTS feature_carousel_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text UNIQUE NOT NULL,
  image_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE feature_carousel_images ENABLE ROW LEVEL SECURITY;

-- Policy for public read access
CREATE POLICY "Anyone can view active features"
  ON feature_carousel_images
  FOR SELECT
  USING (is_active = true);

-- Policy for admin read all
CREATE POLICY "Admins can view all features"
  ON feature_carousel_images
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy for admin insert
CREATE POLICY "Admins can insert features"
  ON feature_carousel_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy for admin update
CREATE POLICY "Admins can update features"
  ON feature_carousel_images
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy for admin delete
CREATE POLICY "Admins can delete features"
  ON feature_carousel_images
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insert default feature images for landlords
INSERT INTO feature_carousel_images (feature_key, image_url, display_order, is_active) VALUES
  ('landlords.lease', '/6.png', 1, true),
  ('landlords.payment', 'https://images.pexels.com/photos/4968630/pexels-photo-4968630.jpeg', 2, true),
  ('landlords.inventory', 'https://images.pexels.com/photos/7078666/pexels-photo-7078666.jpeg', 3, true),
  ('landlords.listings', 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg', 4, true),
  ('landlords.bookings', 'https://images.pexels.com/photos/5717546/pexels-photo-5717546.jpeg', 5, true),
  ('landlords.access', 'https://images.pexels.com/photos/5705471/pexels-photo-5705471.jpeg', 6, true),
  ('landlords.verification', 'https://images.pexels.com/photos/5668838/pexels-photo-5668838.jpeg', 7, true),
  ('landlords.messaging', 'https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg', 8, true),
  ('landlords.stats', 'https://images.pexels.com/photos/7947664/pexels-photo-7947664.jpeg', 9, true)
ON CONFLICT (feature_key) DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_feature_carousel_images_updated_at ON feature_carousel_images;

CREATE TRIGGER update_feature_carousel_images_updated_at
  BEFORE UPDATE ON feature_carousel_images
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

