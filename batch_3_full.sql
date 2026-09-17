/*
  # Permettre l'accès public aux statistiques

  1. Modifications
    - Ajouter une politique pour permettre aux utilisateurs anonymes de lire les profils (pour compter)
    - Ajouter une politique pour permettre aux utilisateurs anonymes de voir les listings actifs
  
  2. Sécurité
    - Les utilisateurs anonymes peuvent seulement lire les données, pas les modifier
    - Les listings inactifs restent cachés pour les utilisateurs anonymes
*/

-- Politique pour permettre aux utilisateurs anonymes de lire les profils (pour les stats)
CREATE POLICY "Profils lisibles publiquement pour les statistiques"
  ON profiles FOR SELECT
  TO anon
  USING (true);

-- Politique pour permettre aux utilisateurs anonymes de voir les listings actifs
CREATE POLICY "Listings actifs visibles publiquement"
  ON listings FOR SELECT
  TO anon
  USING (is_active = true);/*
  # Add English Features to Pricing Plans

  1. Changes
    - Add `features_en` column to `pricing_plans` table for English translations
    - Rename existing `features` to `features_fr` for clarity
    - Populate English translations for existing plans

  2. Data Migration
    - Update existing plans with English feature translations
*/

-- Add features_en column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pricing_plans' AND column_name = 'features_en'
  ) THEN
    ALTER TABLE pricing_plans ADD COLUMN features_en text[] DEFAULT '{}';
  END IF;
END $$;

-- Update existing plans with English translations
UPDATE pricing_plans
SET features_en = ARRAY[
  'Publish 1 listing',
  'Basic features'
]
WHERE name = 'Gratuit' AND type = 'landlord';

UPDATE pricing_plans
SET features_en = ARRAY[
  'Unlimited listings',
  'Availability calendar',
  'Featured placement',
  'Advanced statistics',
  'Priority support'
]
WHERE name = 'Premium' AND type = 'landlord';

UPDATE pricing_plans
SET features_en = ARRAY[
  'Service fees',
  'Booking insurance',
  'Support 24/7'
]
WHERE name = 'Frais de réservation' AND type = 'student';/*
  # Ajout de la caution aux annonces

  1. Modifications
    - Ajout d'une colonne `security_deposit` à la table `listings`
      - Type: numeric (pour stocker des montants en euros)
      - Nullable: oui (optionnel)
      - Description: Montant de la caution/garantie demandée par le propriétaire

  2. Sécurité
    - Pas de changement RLS nécessaire (hérite des règles existantes)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'security_deposit'
  ) THEN
    ALTER TABLE listings ADD COLUMN security_deposit numeric;
  END IF;
END $$;/*
  # Activation de Realtime pour les notifications

  1. Modifications
    - Active REPLICA IDENTITY FULL sur les tables notifications, messages et bookings
    - Cela permet à Supabase Realtime de détecter tous les changements et d'envoyer les données complètes
    - Nécessaire pour que les filtres sur user_id, recipient_id, etc. fonctionnent correctement

  2. Tables concernées
    - `notifications` - pour recevoir les notifications en temps réel
    - `messages` - pour recevoir les messages en temps réel
    - `bookings` - pour recevoir les changements de réservation en temps réel
*/

-- Active REPLICA IDENTITY FULL pour permettre à Realtime de fonctionner avec des filtres
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE bookings REPLICA IDENTITY FULL;/*
  # Création de la table des guides d'accès

  1. Nouvelle Table
    - `access_guides`
      - `id` (uuid, primary key)
      - `listing_id` (uuid, référence vers listings, unique)
      - `access_type` (text) - Type d'accès: 'boite_a_cles', 'remise_en_main_propre', 'autre'
      - `access_instructions` (text) - Instructions détaillées pour accéder au logement
      - `wifi_ssid` (text) - Nom du réseau WiFi
      - `wifi_password` (text) - Mot de passe WiFi
      - `parking_info` (text) - Informations sur le stationnement
      - `access_photos` (text[]) - URLs des photos pour l'accès
      - `access_video` (text) - URL de la vidéo d'accès
      - `additional_info` (text) - Informations additionnelles
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Sécurité
    - Enable RLS sur `access_guides`
    - Les propriétaires peuvent lire et modifier leur guide d'accès
    - Les locataires peuvent lire le guide d'accès seulement s'ils ont une réservation confirmée
*/

CREATE TABLE IF NOT EXISTS access_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid UNIQUE NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  access_type text DEFAULT 'boite_a_cles' CHECK (access_type IN ('boite_a_cles', 'remise_en_main_propre', 'autre')),
  access_instructions text DEFAULT '',
  wifi_ssid text DEFAULT '',
  wifi_password text DEFAULT '',
  parking_info text DEFAULT '',
  access_photos text[] DEFAULT '{}',
  access_video text DEFAULT '',
  additional_info text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE access_guides ENABLE ROW LEVEL SECURITY;

-- Les propriétaires peuvent voir leurs propres guides d'accès
CREATE POLICY "Landlords can view their own access guides"
  ON access_guides FOR SELECT
  TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  );

-- Les propriétaires peuvent créer des guides d'accès pour leurs logements
CREATE POLICY "Landlords can create access guides for their listings"
  ON access_guides FOR INSERT
  TO authenticated
  WITH CHECK (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  );

-- Les propriétaires peuvent modifier leurs propres guides d'accès
CREATE POLICY "Landlords can update their own access guides"
  ON access_guides FOR UPDATE
  TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  )
  WITH CHECK (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  );

-- Les propriétaires peuvent supprimer leurs propres guides d'accès
CREATE POLICY "Landlords can delete their own access guides"
  ON access_guides FOR DELETE
  TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  );

-- Les locataires peuvent voir le guide d'accès s'ils ont une réservation confirmée
CREATE POLICY "Students can view access guides for confirmed bookings"
  ON access_guides FOR SELECT
  TO authenticated
  USING (
    listing_id IN (
      SELECT listing_id FROM bookings 
      WHERE student_id = auth.uid() 
      AND status = 'confirmed'
    )
  );

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_access_guides_listing_id ON access_guides(listing_id);/*
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
WHERE id = 'images';/*
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
/*
  # Fix Feature Carousel RLS Policies

  1. Changes
    - Drop existing SELECT policies that prevent admins from viewing inactive features
    - Create new SELECT policy that allows:
      - Anyone to view active features
      - Admins to view all features (active and inactive)
  
  2. Security
    - Public users can only see active features
    - Admins can see all features for management purposes
*/

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Anyone can view active features" ON feature_carousel_images;
DROP POLICY IF EXISTS "Admins can view all features" ON feature_carousel_images;

-- Create combined SELECT policy
CREATE POLICY "Public views active, admins view all"
  ON feature_carousel_images
  FOR SELECT
  USING (
    is_active = true 
    OR 
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
/*
  # Add Student Feature Carousel Images

  1. New Data
    - Add feature carousel images for students section
    - Features include:
      - Search and discovery
      - Booking system
      - Verified listings
      - Document management
      - Secure messaging
      - Reviews and ratings
      - Favorites
      - Profile management

  2. Notes
    - Using placeholder Pexels images
    - All features start as active by default
    - Display order starts at 10 to avoid conflicts with landlord features
*/

-- Insert default feature images for students
INSERT INTO feature_carousel_images (feature_key, image_url, display_order, is_active) VALUES
  ('students.search', 'https://images.pexels.com/photos/1370704/pexels-photo-1370704.jpeg', 10, true),
  ('students.booking', 'https://images.pexels.com/photos/5717546/pexels-photo-5717546.jpeg', 11, true),
  ('students.verified', 'https://images.pexels.com/photos/5668838/pexels-photo-5668838.jpeg', 12, true),
  ('students.documents', 'https://images.pexels.com/photos/6476589/pexels-photo-6476589.jpeg', 13, true),
  ('students.messaging', 'https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg', 14, true),
  ('students.reviews', 'https://images.pexels.com/photos/7189028/pexels-photo-7189028.jpeg', 15, true),
  ('students.favorites', 'https://images.pexels.com/photos/4050315/pexels-photo-4050315.jpeg', 16, true),
  ('students.profile', 'https://images.pexels.com/photos/3760263/pexels-photo-3760263.jpeg', 17, true)
ON CONFLICT (feature_key) DO NOTHING;
/*
  # Add Missing Student Feature Carousel Images

  1. New Data
    - Add missing student features:
      - Access guide
      - Community features
      - Free platform

  2. Notes
    - Using placeholder Pexels images
    - All features start as active by default
*/

-- Insert missing student feature images
INSERT INTO feature_carousel_images (feature_key, image_url, display_order, is_active) VALUES
  ('students.access', 'https://images.pexels.com/photos/279810/pexels-photo-279810.jpeg', 18, true),
  ('students.community', 'https://images.pexels.com/photos/1595385/pexels-photo-1595385.jpeg', 19, true),
  ('students.free', 'https://images.pexels.com/photos/259027/pexels-photo-259027.jpeg', 20, true)
ON CONFLICT (feature_key) DO NOTHING;
/*
  # Ajout des champs de texte aux carrousels de fonctionnalités

  1. Modifications
    - Ajout de colonnes pour le titre et la description en français et anglais
    - `title_fr` (text) - Titre en français
    - `title_en` (text) - Titre en anglais
    - `description_fr` (text) - Description en français
    - `description_en` (text) - Description en anglais
  
  2. Notes
    - Ces champs sont optionnels pour permettre une transition en douceur
    - Si non renseignés, l'application utilisera les textes hardcodés par défaut
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_carousel_images' AND column_name = 'title_fr'
  ) THEN
    ALTER TABLE feature_carousel_images ADD COLUMN title_fr text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_carousel_images' AND column_name = 'title_en'
  ) THEN
    ALTER TABLE feature_carousel_images ADD COLUMN title_en text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_carousel_images' AND column_name = 'description_fr'
  ) THEN
    ALTER TABLE feature_carousel_images ADD COLUMN description_fr text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feature_carousel_images' AND column_name = 'description_en'
  ) THEN
    ALTER TABLE feature_carousel_images ADD COLUMN description_en text;
  END IF;
END $$;/*
  # Système de Synchronisation iCal Bidirectionnelle

  ## Description
  Ce système permet l'export et l'import bidirectionnel de calendriers au format iCal.
  Les propriétaires peuvent exporter leurs dates bloquées vers Airbnb/Booking.com
  et importer les réservations de ces plateformes dans HelloFonty.

  ## Nouvelles Tables

  ### `ical_sync_tokens`
  Stocke les tokens d'accès uniques pour l'export des calendriers iCal
  - `id` (uuid, clé primaire)
  - `listing_id` (uuid, référence à listings)
  - `token` (text, unique) - Token UUID pour l'URL publique
  - `created_at` (timestamptz)
  - `last_accessed_at` (timestamptz) - Date du dernier téléchargement
  - `access_count` (integer) - Nombre de téléchargements

  ### `external_ical_feeds`
  Stocke les URLs des calendriers externes à importer (Airbnb, Booking, etc.)
  - `id` (uuid, clé primaire)
  - `listing_id` (uuid, référence à listings)
  - `feed_url` (text) - URL du calendrier iCal externe
  - `feed_name` (text) - Nom descriptif (ex: "Airbnb", "Booking.com")
  - `created_at` (timestamptz)
  - `last_synced_at` (timestamptz) - Date de dernière synchronisation
  - `sync_status` (text) - Statut: 'active', 'error', 'disabled'
  - `error_message` (text) - Message d'erreur si échec

  ### `imported_blocked_dates`
  Stocke les dates bloquées importées depuis les calendriers externes
  - `id` (uuid, clé primaire)
  - `listing_id` (uuid, référence à listings)
  - `feed_id` (uuid, référence à external_ical_feeds)
  - `start_date` (date)
  - `end_date` (date)
  - `event_uid` (text) - UID unique de l'événement iCal
  - `summary` (text) - Titre de l'événement
  - `description` (text) - Description de l'événement
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Sécurité (RLS)
  - Les propriétaires peuvent gérer leurs propres tokens et feeds
  - Les tokens d'export sont accessibles publiquement via l'URL
  - Les dates importées sont accessibles comme les dates bloquées normales

  ## Index
  - Index sur listing_id pour toutes les tables
  - Index unique sur token pour ical_sync_tokens
  - Index sur event_uid pour éviter les doublons
  - Index composite sur (listing_id, start_date, end_date) pour les requêtes de disponibilité

  ## Notes Importantes
  1. La synchronisation automatique s'effectue toutes les 30 minutes via fonction Edge
  2. Les dates importées sont différenciées des dates manuelles
  3. Les conflits de réservation génèrent des notifications
  4. Cache du flux iCal: 15 minutes pour optimiser les performances
*/

-- Table des tokens pour l'export iCal
CREATE TABLE IF NOT EXISTS ical_sync_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  created_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz,
  access_count integer DEFAULT 0
);

-- Table des flux iCal externes à importer
CREATE TABLE IF NOT EXISTS external_ical_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  feed_url text NOT NULL,
  feed_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_synced_at timestamptz,
  sync_status text DEFAULT 'active' CHECK (sync_status IN ('active', 'error', 'disabled')),
  error_message text
);

-- Table des dates bloquées importées depuis les calendriers externes
CREATE TABLE IF NOT EXISTS imported_blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  feed_id uuid NOT NULL REFERENCES external_ical_feeds(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  event_uid text NOT NULL,
  summary text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_ical_sync_tokens_listing ON ical_sync_tokens(listing_id);
CREATE INDEX IF NOT EXISTS idx_ical_sync_tokens_token ON ical_sync_tokens(token);
CREATE INDEX IF NOT EXISTS idx_external_ical_feeds_listing ON external_ical_feeds(listing_id);
CREATE INDEX IF NOT EXISTS idx_imported_blocked_dates_listing ON imported_blocked_dates(listing_id);
CREATE INDEX IF NOT EXISTS idx_imported_blocked_dates_feed ON imported_blocked_dates(feed_id);
CREATE INDEX IF NOT EXISTS idx_imported_blocked_dates_uid ON imported_blocked_dates(event_uid);
CREATE INDEX IF NOT EXISTS idx_imported_blocked_dates_dates ON imported_blocked_dates(listing_id, start_date, end_date);

-- Enable RLS
ALTER TABLE ical_sync_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_ical_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE imported_blocked_dates ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour ical_sync_tokens

-- Les propriétaires peuvent voir leurs propres tokens
CREATE POLICY "Owners can view own sync tokens"
  ON ical_sync_tokens FOR SELECT
  TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  );

-- Les propriétaires peuvent créer des tokens pour leurs listings
CREATE POLICY "Owners can create sync tokens"
  ON ical_sync_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  );

-- Les propriétaires peuvent supprimer leurs tokens
CREATE POLICY "Owners can delete own sync tokens"
  ON ical_sync_tokens FOR DELETE
  TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  );

-- Les propriétaires peuvent mettre à jour leurs tokens (pour last_accessed_at, access_count)
CREATE POLICY "Owners can update own sync tokens"
  ON ical_sync_tokens FOR UPDATE
  TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  )
  WITH CHECK (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  );

-- RLS Policies pour external_ical_feeds

-- Les propriétaires peuvent voir leurs propres feeds
CREATE POLICY "Owners can view own ical feeds"
  ON external_ical_feeds FOR SELECT
  TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  );

-- Les propriétaires peuvent créer des feeds pour leurs listings
CREATE POLICY "Owners can create ical feeds"
  ON external_ical_feeds FOR INSERT
  TO authenticated
  WITH CHECK (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  );

-- Les propriétaires peuvent mettre à jour leurs feeds
CREATE POLICY "Owners can update own ical feeds"
  ON external_ical_feeds FOR UPDATE
  TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  )
  WITH CHECK (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  );

-- Les propriétaires peuvent supprimer leurs feeds
CREATE POLICY "Owners can delete own ical feeds"
  ON external_ical_feeds FOR DELETE
  TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  );

-- RLS Policies pour imported_blocked_dates

-- Les dates importées sont visibles comme les dates bloquées normales
CREATE POLICY "Anyone can view imported blocked dates"
  ON imported_blocked_dates FOR SELECT
  TO authenticated
  USING (true);

-- Seul le système peut insérer des dates importées (via fonction Edge)
CREATE POLICY "System can insert imported blocked dates"
  ON imported_blocked_dates FOR INSERT
  TO authenticated
  WITH CHECK (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  );

-- Seul le système peut mettre à jour des dates importées
CREATE POLICY "System can update imported blocked dates"
  ON imported_blocked_dates FOR UPDATE
  TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  )
  WITH CHECK (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  );

-- Les propriétaires peuvent supprimer les dates importées de leurs listings
CREATE POLICY "Owners can delete imported blocked dates"
  ON imported_blocked_dates FOR DELETE
  TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  );

-- Fonction pour nettoyer les anciennes dates importées (> 1 an dans le passé)
CREATE OR REPLACE FUNCTION cleanup_old_imported_dates()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM imported_blocked_dates
  WHERE end_date < CURRENT_DATE - INTERVAL '1 year';
END;
$$;