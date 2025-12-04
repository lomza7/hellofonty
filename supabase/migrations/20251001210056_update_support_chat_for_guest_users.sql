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
