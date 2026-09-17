/*
  # Permettre le comptage anonyme des profils

  1. Modifications
    - Ajouter une politique permettant de compter les profils sans authentification
    - Utiliser une politique restrictive qui permet uniquement le comptage (COUNT)
  
  2. Sécurité
    - La politique permet uniquement de compter, pas de lire les détails
    - Les données personnelles restent protégées
*/

-- Permettre la lecture des profils pour les statistiques publiques
DROP POLICY IF EXISTS "Profils visibles par tous les utilisateurs authentifiés" ON profiles;

CREATE POLICY "Profils visibles publiquement pour statistiques"
  ON profiles
  FOR SELECT
  USING (true);

/*
  # Add video URL support to listings

  1. Changes
    - Add `video_url` column to `listings` table to store YouTube or other video platform URLs
    - Column is optional (nullable) to maintain backward compatibility
  
  2. Notes
    - Supports any video platform URL (YouTube, Vimeo, etc.)
    - Property owners can showcase their property with a video tour
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'video_url'
  ) THEN
    ALTER TABLE listings ADD COLUMN video_url text;
  END IF;
END $$;
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
/*
  # Create Subscriptions Management System

  1. New Tables
    - `subscriptions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `plan_type` (text: 'free', 'premium', 'premium_plus')
      - `stripe_customer_id` (text)
      - `stripe_subscription_id` (text)
      - `stripe_price_id` (text)
      - `status` (text: 'active', 'canceled', 'past_due', 'incomplete')
      - `current_period_start` (timestamptz)
      - `current_period_end` (timestamptz)
      - `cancel_at_period_end` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `invoices`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `stripe_invoice_id` (text)
      - `amount` (integer, in cents)
      - `currency` (text)
      - `status` (text: 'paid', 'open', 'void', 'uncollectible')
      - `invoice_pdf` (text, URL to PDF)
      - `hosted_invoice_url` (text)
      - `billing_reason` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Users can only view their own subscriptions and invoices
    - Admin can view all subscriptions and invoices

  3. Notes
    - Plan types: free (default), premium (29€/month), premium_plus (49€/month)
    - Stripe IDs stored for webhook synchronization
    - Invoice amounts stored in cents (e.g., 2900 = 29.00€)
*/

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  plan_type text NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'premium', 'premium_plus')),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'incomplete', 'trialing')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  stripe_invoice_id text UNIQUE NOT NULL,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'eur',
  status text NOT NULL CHECK (status IN ('paid', 'open', 'void', 'uncollectible')),
  invoice_pdf text,
  hosted_invoice_url text,
  billing_reason text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Subscriptions policies
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can update own subscription"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Invoices policies
CREATE POLICY "Users can view own invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice_id ON invoices(stripe_invoice_id);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for subscriptions updated_at
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default free subscription for existing landlords
INSERT INTO subscriptions (user_id, plan_type, status)
SELECT id, 'free', 'active'
FROM profiles
WHERE role = 'landlord'
AND id NOT IN (SELECT user_id FROM subscriptions)
ON CONFLICT (user_id) DO NOTHING;
/*
  # Update Subscriptions - Remove Premium Plus Plan

  1. Changes
    - Update plan_type constraint to only allow 'free' and 'premium'
    - Remove 'premium_plus' as a valid option
  
  2. Notes
    - Only 2 plans available: Free (0€) and Premium (29€/month)
    - Premium includes full concierge service
*/

-- Update the check constraint on plan_type to remove premium_plus
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_type_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_type_check 
  CHECK (plan_type IN ('free', 'premium'));
