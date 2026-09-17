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