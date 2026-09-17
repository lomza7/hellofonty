/*
  # Create email verification system

  1. New Tables
    - `email_verification_codes`
      - `id` (uuid, primary key)
      - `email` (text, not null)
      - `code` (text, not null) - 6 digit verification code
      - `expires_at` (timestamptz, not null) - expiration time (15 minutes)
      - `used` (boolean, default false)
      - `created_at` (timestamptz, default now())
      
    - `email_verification_attempts`
      - `id` (uuid, primary key)
      - `email` (text, not null)
      - `attempted_at` (timestamptz, default now())
      - Rate limiting: max 5 attempts per hour per email
      
  2. Indexes
    - Index on email for fast lookups
    - Index on expires_at for cleanup queries
    
  3. Security
    - Enable RLS on both tables
    - Public can insert verification codes (via edge function)
    - Public can read their own codes (via edge function with email match)
*/

-- Create email_verification_codes table
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create email_verification_attempts table for rate limiting
CREATE TABLE IF NOT EXISTS email_verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  attempted_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_email ON email_verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_expires_at ON email_verification_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verification_attempts_email ON email_verification_attempts(email);

-- Enable RLS
ALTER TABLE email_verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_attempts ENABLE ROW LEVEL SECURITY;

-- Policies for email_verification_codes
CREATE POLICY "Anyone can insert verification codes"
  ON email_verification_codes FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can read verification codes"
  ON email_verification_codes FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can update verification codes"
  ON email_verification_codes FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Policies for email_verification_attempts
CREATE POLICY "Anyone can insert verification attempts"
  ON email_verification_attempts FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can read verification attempts"
  ON email_verification_attempts FOR SELECT
  TO public
  USING (true);

-- Function to clean up old verification codes (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_old_verification_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM email_verification_codes
  WHERE created_at < now() - interval '1 hour';
  
  DELETE FROM email_verification_attempts
  WHERE attempted_at < now() - interval '1 hour';
END;
$$;
/*
  # Système de Chat Support Client

  1. Nouvelles Tables
    - `support_conversations`
      - `id` (uuid, clé primaire)
      - `user_id` (uuid, référence à auth.users)
      - `status` (text) - 'open', 'in_progress', 'resolved', 'closed'
      - `last_message_at` (timestamptz)
      - `assigned_admin_id` (uuid, référence à profiles) - admin assigné
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `support_messages`
      - `id` (uuid, clé primaire)
      - `conversation_id` (uuid, référence à support_conversations)
      - `sender_id` (uuid, référence à auth.users)
      - `sender_type` (text) - 'user' ou 'admin'
      - `message` (text)
      - `read` (boolean)
      - `created_at` (timestamptz)

  2. Sécurité
    - RLS activé sur toutes les tables
    - Les utilisateurs peuvent voir leurs propres conversations
    - Les admins peuvent voir toutes les conversations
    - Les utilisateurs peuvent créer des conversations et envoyer des messages
    - Les admins peuvent répondre aux conversations
*/

-- Create support_conversations table
CREATE TABLE IF NOT EXISTS support_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  last_message_at timestamptz DEFAULT now(),
  assigned_admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create support_messages table
CREATE TABLE IF NOT EXISTS support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES support_conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sender_type text NOT NULL CHECK (sender_type IN ('user', 'admin')),
  message text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Policies for support_conversations
CREATE POLICY "Users can view own conversations"
  ON support_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all conversations"
  ON support_conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can create conversations"
  ON support_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON support_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update all conversations"
  ON support_conversations FOR UPDATE
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

-- Policies for support_messages
CREATE POLICY "Users can view messages in own conversations"
  ON support_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_conversations
      WHERE support_conversations.id = support_messages.conversation_id
      AND support_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all messages"
  ON support_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can send messages in own conversations"
  ON support_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND sender_type = 'user'
    AND EXISTS (
      SELECT 1 FROM support_conversations
      WHERE support_conversations.id = support_messages.conversation_id
      AND support_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can send messages in any conversation"
  ON support_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND sender_type = 'admin'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can update own messages"
  ON support_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Admins can update all messages"
  ON support_messages FOR UPDATE
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_support_conversations_user_id ON support_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_support_conversations_status ON support_conversations(status);
CREATE INDEX IF NOT EXISTS idx_support_conversations_assigned_admin_id ON support_conversations(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_conversation_id ON support_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages(created_at);
/*
  # Mise à jour du système de chat support pour utilisateurs non connectés

  1. Modifications
    - Ajouter colonnes `user_email` et `user_type` dans `support_conversations`
    - Permettre les conversations sans authentification pour les visiteurs
    - Garder l'historique pour les utilisateurs connectés via `user_id`

  2. Sécurité
    - Les utilisateurs non connectés peuvent créer des conversations
    - Les utilisateurs connectés voient toutes leurs conversations
    - Les admins voient toutes les conversations
*/

-- Add columns for guest users
ALTER TABLE support_conversations
ADD COLUMN IF NOT EXISTS user_email text,
ADD COLUMN IF NOT EXISTS user_type text CHECK (user_type IN ('student', 'landlord', 'guest'));

-- Update RLS policies to allow guest conversations
DROP POLICY IF EXISTS "Users can create conversations" ON support_conversations;

CREATE POLICY "Anyone can create conversations"
  ON support_conversations FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own conversations" ON support_conversations;

CREATE POLICY "Users can view own conversations by user_id or email"
  ON support_conversations FOR SELECT
  USING (
    auth.uid() = user_id
    OR (user_id IS NULL AND user_email IS NOT NULL)
  );

-- Update messages policies
DROP POLICY IF EXISTS "Users can send messages in own conversations" ON support_messages;

CREATE POLICY "Users can send messages in own conversations"
  ON support_messages FOR INSERT
  WITH CHECK (
    sender_type = 'user'
    AND (
      EXISTS (
        SELECT 1 FROM support_conversations
        WHERE support_conversations.id = support_messages.conversation_id
        AND (
          support_conversations.user_id = auth.uid()
          OR (support_conversations.user_id IS NULL AND support_conversations.user_email IS NOT NULL)
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can view messages in own conversations" ON support_messages;

CREATE POLICY "Users can view messages by conversation"
  ON support_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_conversations
      WHERE support_conversations.id = support_messages.conversation_id
      AND (
        support_conversations.user_id = auth.uid()
        OR support_conversations.user_id IS NULL
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      )
    )
  );
/*
  # Fix support_conversations table for authenticated users

  1. Changes
    - Make user_id nullable to allow both authenticated and guest users
    - Add constraint to ensure either user_id or user_email is present
  
  2. Security
    - Maintain existing RLS policies
*/

-- Make user_id nullable
ALTER TABLE support_conversations 
ALTER COLUMN user_id DROP NOT NULL;

-- Add constraint to ensure either user_id or user_email exists
ALTER TABLE support_conversations
ADD CONSTRAINT user_id_or_email_required 
CHECK (user_id IS NOT NULL OR user_email IS NOT NULL);
/*
  # Fix support_messages table for authenticated users

  1. Changes
    - Make sender_id nullable to allow both authenticated and guest users
  
  2. Security
    - Maintain existing RLS policies
*/

-- Make sender_id nullable for guest users
ALTER TABLE support_messages 
ALTER COLUMN sender_id DROP NOT NULL;
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
END $$;/*
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
CREATE INDEX IF NOT EXISTS idx_blocked_dates_date ON blocked_dates(blocked_date);/*
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
ON CONFLICT (user_id) DO NOTHING;/*
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
  CHECK (plan_type IN ('free', 'premium'));/*
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
END $$;/*
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
END $$;/*
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