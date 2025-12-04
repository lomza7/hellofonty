/*
  # Cr\u00e9ation de la table blocked_dates pour la gestion du calendrier

  1. Nouvelle table
    - `blocked_dates`
      - `id` (uuid, cl\u00e9 primaire)
      - `listing_id` (uuid, r\u00e9f\u00e9rence vers listings)
      - `blocked_date` (date, date bloqu\u00e9e)
      - `created_at` (timestamp)
      - `created_by` (uuid, r\u00e9f\u00e9rence vers profiles)
  
  2. S\u00e9curit\u00e9
    - Enable RLS sur la table `blocked_dates`
    - Politique pour que les propri\u00e9taires puissent voir leurs dates bloqu\u00e9es
    - Politique pour que les propri\u00e9taires puissent ajouter des dates bloqu\u00e9es
    - Politique pour que les propri\u00e9taires puissent supprimer des dates bloqu\u00e9es
    - Politique pour que tout le monde puisse voir les dates bloqu\u00e9es (lecture publique)
  
  3. Index
    - Index sur listing_id pour optimiser les requ\u00eates
    - Index unique sur (listing_id, blocked_date) pour \u00e9viter les doublons
*/

CREATE TABLE IF NOT EXISTS blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  blocked_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(listing_id, blocked_date)
);

ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;

-- Les propri\u00e9taires peuvent voir leurs dates bloqu\u00e9es
CREATE POLICY "Landlords can view their blocked dates"
  ON blocked_dates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = blocked_dates.listing_id
      AND listings.landlord_id = auth.uid()
    )
  );

-- Lecture publique des dates bloqu\u00e9es (pour que les locataires voient les dates indisponibles)
CREATE POLICY "Anyone can view blocked dates"
  ON blocked_dates
  FOR SELECT
  USING (true);

-- Les propri\u00e9taires peuvent ajouter des dates bloqu\u00e9es
CREATE POLICY "Landlords can insert blocked dates"
  ON blocked_dates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = blocked_dates.listing_id
      AND listings.landlord_id = auth.uid()
    )
  );

-- Les propri\u00e9taires peuvent supprimer des dates bloqu\u00e9es
CREATE POLICY "Landlords can delete blocked dates"
  ON blocked_dates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = blocked_dates.listing_id
      AND listings.landlord_id = auth.uid()
    )
  );

-- Index pour optimiser les requ\u00eates
CREATE INDEX IF NOT EXISTS idx_blocked_dates_listing_id ON blocked_dates(listing_id);
CREATE INDEX IF NOT EXISTS idx_blocked_dates_date ON blocked_dates(blocked_date);