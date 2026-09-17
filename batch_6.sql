/*
  # Système de gestion des plans tarifaires

  1. Nouvelle table
    - `pricing_plans` : Gestion centralisée des offres
      - `id` (uuid, primary key)
      - `name` (text) : Nom du plan (ex: "Gratuit Propriétaire", "Premium Propriétaire", "Frais Étudiant")
      - `type` (text) : Type d'utilisateur ('landlord' ou 'student')
      - `plan_category` (text) : Catégorie ('subscription' ou 'booking_fee')
      - `price` (numeric) : Prix en euros
      - `currency` (text) : Devise (EUR par défaut)
      - `billing_period` (text) : Période de facturation ('monthly', 'one_time', etc.)
      - `stripe_price_id` (text) : ID du prix Stripe
      - `stripe_product_id` (text) : ID du produit Stripe
      - `features` (jsonb) : Liste des fonctionnalités incluses
      - `is_active` (boolean) : Plan actif ou non
      - `display_order` (integer) : Ordre d'affichage
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Sécurité
    - Enable RLS sur `pricing_plans`
    - Les plans sont lisibles par tous (pour affichage public)
    - Seuls les admins peuvent modifier les plans
*/

-- Créer la table pricing_plans
CREATE TABLE IF NOT EXISTS pricing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('landlord', 'student')),
  plan_category text NOT NULL CHECK (plan_category IN ('subscription', 'booking_fee')),
  price numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  billing_period text NOT NULL CHECK (billing_period IN ('monthly', 'yearly', 'one_time')),
  stripe_price_id text,
  stripe_product_id text,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE pricing_plans ENABLE ROW LEVEL SECURITY;

-- Policy: Tout le monde peut lire les plans actifs
CREATE POLICY "Anyone can view active pricing plans"
  ON pricing_plans
  FOR SELECT
  USING (is_active = true);

-- Policy: Les admins peuvent tout voir
CREATE POLICY "Admins can view all pricing plans"
  ON pricing_plans
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Les admins peuvent créer des plans
CREATE POLICY "Admins can create pricing plans"
  ON pricing_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Les admins peuvent modifier des plans
CREATE POLICY "Admins can update pricing plans"
  ON pricing_plans
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

-- Policy: Les admins peuvent supprimer des plans
CREATE POLICY "Admins can delete pricing plans"
  ON pricing_plans
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_pricing_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS update_pricing_plans_timestamp ON pricing_plans;
CREATE TRIGGER update_pricing_plans_timestamp
  BEFORE UPDATE ON pricing_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_pricing_plans_updated_at();

-- Insérer les plans par défaut
INSERT INTO pricing_plans (name, type, plan_category, price, billing_period, features, display_order) VALUES
  ('Gratuit', 'landlord', 'subscription', 0, 'monthly', '["Publier 1 annonce", "Fonctionnalités de base"]'::jsonb, 1),
  ('Premium', 'landlord', 'subscription', 29, 'monthly', '["Annonces illimitées", "Calendrier de disponibilité", "Mise en avant", "Statistiques avancées", "Support prioritaire"]'::jsonb, 2),
  ('Frais de réservation', 'student', 'booking_fee', 500, 'one_time', '["Frais de service", "Assurance réservation", "Support 24/7"]'::jsonb, 1)
ON CONFLICT DO NOTHING;

/*
  # Ajouter des politiques admin pour les annonces

  1. Modifications de sécurité
    - Permettre aux admins de voir TOUTES les annonces (même inactives)
    - Permettre aux admins de modifier TOUTES les annonces
    - Permettre aux admins de supprimer TOUTES les annonces
  
  2. Notes importantes
    - Les admins ont un contrôle total sur toutes les annonces
    - Les propriétaires conservent leurs droits existants
    - Les utilisateurs normaux continuent de voir seulement les annonces actives
*/

-- Politique pour permettre aux admins de voir TOUTES les annonces
CREATE POLICY "Admins peuvent voir toutes les annonces"
  ON listings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Politique pour permettre aux admins de modifier TOUTES les annonces
CREATE POLICY "Admins peuvent modifier toutes les annonces"
  ON listings
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

-- Politique pour permettre aux admins de supprimer TOUTES les annonces
CREATE POLICY "Admins peuvent supprimer toutes les annonces"
  ON listings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

/*
  # Add House Rules to Listings

  1. Changes
    - Add house rules columns to listings table:
      - `check_in_start` (text) - Check-in start time (e.g., "14:00")
      - `check_in_end` (text) - Check-in end time (e.g., "22:00")
      - `check_out_time` (text) - Check-out time (e.g., "11:00")
      - `pets_allowed` (boolean) - Whether pets are allowed
      - `smoking_allowed` (boolean) - Whether smoking is allowed
      - `quiet_hours_start` (text) - Quiet hours start time (e.g., "22:00")
      - `quiet_hours_end` (text) - Quiet hours end time (e.g., "08:00")
      - `additional_rules` (text) - Additional custom rules
      - `parties_allowed` (boolean) - Whether parties/events are allowed
      - `children_allowed` (boolean) - Whether children are allowed

  2. Notes
    - All fields are optional with sensible defaults
    - Times are stored as text in 24-hour format (HH:MM)
    - Boolean fields default to true/false based on common preferences
*/

-- Add house rules columns to listings table
DO $$
BEGIN
  -- Check-in and check-out times
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'check_in_start'
  ) THEN
    ALTER TABLE listings ADD COLUMN check_in_start text DEFAULT '14:00';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'check_in_end'
  ) THEN
    ALTER TABLE listings ADD COLUMN check_in_end text DEFAULT '22:00';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'check_out_time'
  ) THEN
    ALTER TABLE listings ADD COLUMN check_out_time text DEFAULT '11:00';
  END IF;

  -- Rules about pets, smoking, parties, children
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'pets_allowed'
  ) THEN
    ALTER TABLE listings ADD COLUMN pets_allowed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'smoking_allowed'
  ) THEN
    ALTER TABLE listings ADD COLUMN smoking_allowed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'parties_allowed'
  ) THEN
    ALTER TABLE listings ADD COLUMN parties_allowed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'children_allowed'
  ) THEN
    ALTER TABLE listings ADD COLUMN children_allowed boolean DEFAULT true;
  END IF;

  -- Quiet hours
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'quiet_hours_start'
  ) THEN
    ALTER TABLE listings ADD COLUMN quiet_hours_start text DEFAULT '22:00';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'quiet_hours_end'
  ) THEN
    ALTER TABLE listings ADD COLUMN quiet_hours_end text DEFAULT '08:00';
  END IF;

  -- Additional custom rules
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'additional_rules'
  ) THEN
    ALTER TABLE listings ADD COLUMN additional_rules text;
  END IF;
END $$;
/*
  # Add Minimum Stay to Listings

  1. Changes
    - Add `minimum_stay` column to listings table
      - Type: integer
      - Default: 1 (1 month minimum)
      - Represents the minimum duration in months for a rental

  2. Notes
    - This field helps landlords set their minimum rental period
    - Default value of 1 month is suitable for student housing
    - Value represents number of months
*/

-- Add minimum_stay column to listings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'minimum_stay'
  ) THEN
    ALTER TABLE listings ADD COLUMN minimum_stay integer DEFAULT 1;
  END IF;
END $$;
/*
  # Système de Détection des Messages Bloqués

  1. Nouvelle Table
    - `blocked_messages`
      - `id` (uuid, primary key)
      - `user_id` (uuid, référence à profiles) - utilisateur qui a tenté d'envoyer
      - `recipient_id` (uuid, référence à profiles) - destinataire prévu
      - `blocked_content` (text) - contenu du message bloqué
      - `detection_type` (text) - type de contenu détecté
      - `detected_patterns` (jsonb) - patterns spécifiques détectés
      - `created_at` (timestamptz) - date de la tentative
      - `conversation_context` (text) - contexte optionnel
      - `booking_id` (uuid, nullable) - lien vers réservation si applicable

  2. Sécurité
    - Enable RLS sur `blocked_messages`
    - Seuls les admins peuvent lire les tentatives bloquées
    - Système peut insérer (pour enregistrer les tentatives)

  3. Index
    - Index sur `user_id` pour compter rapidement les tentatives par utilisateur
    - Index sur `created_at` pour tri chronologique
*/

-- Create blocked_messages table
CREATE TABLE IF NOT EXISTS blocked_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  recipient_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  blocked_content text NOT NULL,
  detection_type text NOT NULL,
  detected_patterns jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  conversation_context text,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS blocked_messages_user_id_idx ON blocked_messages(user_id);
CREATE INDEX IF NOT EXISTS blocked_messages_created_at_idx ON blocked_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS blocked_messages_recipient_id_idx ON blocked_messages(recipient_id);

-- Enable RLS
ALTER TABLE blocked_messages ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own blocked attempts (for logging)
CREATE POLICY "Users can insert own blocked messages"
  ON blocked_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Only admins can view all blocked messages
CREATE POLICY "Admins can view all blocked messages"
  ON blocked_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to count user's blocked attempts in last 30 days
CREATE OR REPLACE FUNCTION get_user_blocked_attempts_count(target_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::integer
  FROM blocked_messages
  WHERE user_id = target_user_id
  AND created_at > NOW() - INTERVAL '30 days';
$$;

-- Function to get blocked message statistics for admin
CREATE OR REPLACE FUNCTION get_blocked_messages_stats()
RETURNS TABLE (
  total_last_7_days bigint,
  total_last_30_days bigint,
  users_at_risk bigint,
  most_common_type text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH last_7_days AS (
    SELECT COUNT(*) as count_7d
    FROM blocked_messages
    WHERE created_at > NOW() - INTERVAL '7 days'
  ),
  last_30_days AS (
    SELECT COUNT(*) as count_30d
    FROM blocked_messages
    WHERE created_at > NOW() - INTERVAL '30 days'
  ),
  at_risk AS (
    SELECT COUNT(DISTINCT user_id) as risk_count
    FROM blocked_messages
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY user_id
    HAVING COUNT(*) >= 3
  ),
  common_type AS (
    SELECT detection_type
    FROM blocked_messages
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY detection_type
    ORDER BY COUNT(*) DESC
    LIMIT 1
  )
  SELECT 
    (SELECT count_7d FROM last_7_days),
    (SELECT count_30d FROM last_30_days),
    COALESCE((SELECT risk_count FROM at_risk), 0),
    COALESCE((SELECT detection_type FROM common_type), 'none');
$$;
