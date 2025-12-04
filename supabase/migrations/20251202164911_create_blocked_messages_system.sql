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