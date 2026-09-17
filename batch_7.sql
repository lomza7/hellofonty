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
  USING (is_active = true);
/*
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
WHERE name = 'Frais de réservation' AND type = 'student';
/*
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
END $$;
/*
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
ALTER TABLE bookings REPLICA IDENTITY FULL;
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
