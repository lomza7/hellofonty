/*
  # Ajouter la colonne event à la table messages
  
  1. Modifications
    - Ajouter la colonne event (text, nullable) à la table messages
    - Cette colonne est utilisée pour identifier le type de message système
  
  2. Impact
    - Permet aux messages système d'avoir un type (ex: 'payment_required')
    - Requis pour la fonction send_system_message
*/

-- Ajouter la colonne event si elle n'existe pas déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'event'
  ) THEN
    ALTER TABLE messages ADD COLUMN event text;
  END IF;
END $$;