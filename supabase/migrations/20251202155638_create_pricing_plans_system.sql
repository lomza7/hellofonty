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
