/*
  # Ajouter les colonnes manquantes à la table messages
  
  1. Modifications
    - Ajouter la colonne topic (text) pour organiser les conversations
    - Ajouter la colonne extension (text) pour identifier le type de message
    - Ajouter la colonne payload (jsonb) pour données additionnelles
    - Ajouter la colonne event (text) pour les messages système
    - Ajouter la colonne private (boolean) pour les messages privés
  
  2. Impact
    - Permet aux messages système de fonctionner correctement
    - Compatible avec la fonction send_system_message
*/

-- Ajouter les colonnes manquantes si elles n'existent pas
DO $$
BEGIN
  -- Ajouter topic
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'topic'
  ) THEN
    ALTER TABLE messages ADD COLUMN topic text NOT NULL DEFAULT '';
  END IF;

  -- Ajouter extension
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'extension'
  ) THEN
    ALTER TABLE messages ADD COLUMN extension text NOT NULL DEFAULT 'message';
  END IF;

  -- Ajouter payload
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'payload'
  ) THEN
    ALTER TABLE messages ADD COLUMN payload jsonb;
  END IF;

  -- Ajouter event
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'event'
  ) THEN
    ALTER TABLE messages ADD COLUMN event text;
  END IF;

  -- Ajouter private
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'private'
  ) THEN
    ALTER TABLE messages ADD COLUMN private boolean DEFAULT false;
  END IF;
END $$;