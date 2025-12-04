/*
  # Activation de Realtime pour les notifications

  1. Modifications
    - Active REPLICA IDENTITY FULL sur les tables notifications, messages et bookings
    - Cela permet à Supabase Realtime de détecter tous les changements et d'envoyer les données complètes
    - Nécessaire pour que les filtres sur user_id, recipient_id, etc. fonctionnent correctement

  2. Tables concernées
    - `notifications` - pour recevoir les notifications en temps réel
    - `messages` - pour recevoir les messages en temps réel
    - `bookings` - pour recevoir les changements de réservation en temps réel
*/

-- Active REPLICA IDENTITY FULL pour permettre à Realtime de fonctionner avec des filtres
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE bookings REPLICA IDENTITY FULL;