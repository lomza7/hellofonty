/*
  # Ajouter booking_id à la table messages

  1. Modifications
    - Ajoute une colonne `booking_id` à la table `messages` pour lier les messages aux demandes de réservation
    - Crée un index sur `booking_id` pour améliorer les performances de recherche
    
  2. Notes
    - Permet d'afficher les demandes de réservation dans les conversations
    - Facilite la gestion des demandes de réservation via la messagerie
*/

-- Ajouter la colonne booking_id à la table messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'booking_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Créer un index sur booking_id
CREATE INDEX IF NOT EXISTS idx_messages_booking_id ON messages(booking_id);