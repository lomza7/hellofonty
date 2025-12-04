/*
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
CREATE INDEX IF NOT EXISTS idx_access_guides_listing_id ON access_guides(listing_id);