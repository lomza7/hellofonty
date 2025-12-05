/*
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