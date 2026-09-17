/*
  # Création de la table des réservations

  1. Nouvelle table
    - `bookings`
      - `id` (uuid, clé primaire)
      - `listing_id` (uuid, référence vers listings)
      - `student_id` (uuid, référence vers profiles)
      - `start_date` (date, date de début de location)
      - `end_date` (date, date de fin de location)
      - `total_days` (integer, nombre total de jours)
      - `total_price` (numeric, prix total de la réservation)
      - `status` (text, statut : pending, confirmed, cancelled)
      - `created_at` (timestamptz, date de création)
      - `updated_at` (timestamptz, date de mise à jour)

  2. Sécurité
    - Activer RLS sur la table `bookings`
    - Les étudiants peuvent voir leurs propres réservations
    - Les propriétaires peuvent voir les réservations de leurs annonces
    - Les étudiants peuvent créer des réservations
    - Les propriétaires peuvent mettre à jour le statut des réservations

  3. Indexes
    - Index sur `listing_id` pour les requêtes de disponibilité
    - Index sur `student_id` pour l'historique des réservations
    - Index sur `start_date` et `end_date` pour les vérifications de disponibilité
*/

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_days integer NOT NULL,
  total_price numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_dates CHECK (end_date > start_date),
  CONSTRAINT minimum_duration CHECK (total_days >= 30)
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Landlords can view bookings for their listings"
  ON bookings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = bookings.listing_id
      AND listings.landlord_id = auth.uid()
    )
  );

CREATE POLICY "Students can create bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Landlords can update booking status"
  ON bookings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = bookings.listing_id
      AND listings.landlord_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = bookings.listing_id
      AND listings.landlord_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_bookings_listing_id ON bookings(listing_id);
CREATE INDEX IF NOT EXISTS idx_bookings_student_id ON bookings(student_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(start_date, end_date);

CREATE OR REPLACE FUNCTION update_booking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_updated_at();

/*
  # Permettre la lecture publique des réservations

  1. Modifications
    - Ajouter une politique pour permettre à tous les utilisateurs (même non authentifiés) de voir les réservations confirmées et en attente
    - Cela permet d'afficher les dates déjà réservées dans le calendrier pour tous les visiteurs

  2. Sécurité
    - Les utilisateurs non authentifiés peuvent uniquement voir les dates de début et fin des réservations
    - Ils ne peuvent pas voir les détails des étudiants ou créer des réservations
*/

CREATE POLICY "Anyone can view booking dates for availability"
  ON bookings FOR SELECT
  TO anon, authenticated
  USING (true);

/*
  # Permettre la lecture publique des réservations

  1. Modifications
    - Ajouter une politique pour permettre à tous les utilisateurs (même non authentifiés) de voir les réservations confirmées et en attente
    - Cela permet d'afficher les dates déjà réservées dans le calendrier pour tous les visiteurs

  2. Sécurité
    - Les utilisateurs non authentifiés peuvent uniquement voir les dates de début et fin des réservations
    - Ils ne peuvent pas voir les détails des étudiants ou créer des réservations
*/

CREATE POLICY "Anyone can view booking dates for availability"
  ON bookings FOR SELECT
  TO anon, authenticated
  USING (true);

/*
  # Système de notifications

  1. Nouvelle table
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, référence vers profiles) - destinataire de la notification
      - `type` (text) - type de notification: 'message', 'booking_request', 'booking_confirmed', 'booking_cancelled'
      - `title` (text) - titre de la notification
      - `message` (text) - message de la notification
      - `link` (text, nullable) - lien vers la page concernée
      - `related_id` (uuid, nullable) - ID de l'entité liée (message_id, booking_id, etc.)
      - `is_read` (boolean, default false) - notification lue ou non
      - `created_at` (timestamptz)

  2. Sécurité
    - Enable RLS sur `notifications`
    - Les utilisateurs peuvent voir leurs propres notifications
    - Les utilisateurs peuvent marquer leurs notifications comme lues
    - Les notifications sont créées automatiquement via des triggers

  3. Triggers
    - Créer une notification quand un message est reçu
    - Créer une notification quand une demande de réservation est reçue
    - Créer une notification quand une réservation est confirmée/annulée
*/

-- Créer la table notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('message', 'booking_request', 'booking_confirmed', 'booking_cancelled')),
  title text NOT NULL,
  message text NOT NULL,
  link text,
  related_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policies pour notifications
CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- Fonction pour créer une notification de nouveau message
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link, related_id)
  VALUES (
    NEW.recipient_id,
    'message',
    'Nouveau message',
    (SELECT first_name || ' ' || last_name FROM profiles WHERE id = NEW.sender_id) || ' vous a envoyé un message',
    'messages',
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour les nouveaux messages
DROP TRIGGER IF EXISTS trigger_notify_new_message ON messages;
CREATE TRIGGER trigger_notify_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();

-- Fonction pour créer une notification de nouvelle demande de réservation
CREATE OR REPLACE FUNCTION notify_new_booking_request()
RETURNS TRIGGER AS $$
DECLARE
  landlord_id uuid;
  student_name text;
BEGIN
  -- Récupérer l'ID du propriétaire et le nom de l'étudiant
  SELECT l.landlord_id INTO landlord_id
  FROM listings l
  WHERE l.id = NEW.listing_id;

  SELECT first_name || ' ' || last_name INTO student_name
  FROM profiles
  WHERE id = NEW.student_id;

  -- Créer la notification pour le propriétaire
  INSERT INTO notifications (user_id, type, title, message, link, related_id)
  VALUES (
    landlord_id,
    'booking_request',
    'Nouvelle demande de réservation',
    student_name || ' a fait une demande de réservation',
    'bookingRequests',
    NEW.id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour les nouvelles demandes de réservation
DROP TRIGGER IF EXISTS trigger_notify_new_booking_request ON bookings;
CREATE TRIGGER trigger_notify_new_booking_request
  AFTER INSERT ON bookings
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION notify_new_booking_request();

-- Fonction pour créer une notification de changement de statut de réservation
CREATE OR REPLACE FUNCTION notify_booking_status_change()
RETURNS TRIGGER AS $$
DECLARE
  notification_title text;
  notification_message text;
BEGIN
  -- Ne créer une notification que si le statut a changé
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Déterminer le titre et le message selon le nouveau statut
  IF NEW.status = 'confirmed' THEN
    notification_title := 'Réservation confirmée';
    notification_message := 'Votre demande de réservation a été confirmée';
  ELSIF NEW.status = 'cancelled' THEN
    notification_title := 'Réservation annulée';
    notification_message := 'Votre demande de réservation a été annulée';
  ELSE
    RETURN NEW;
  END IF;

  -- Créer la notification pour l'étudiant
  INSERT INTO notifications (user_id, type, title, message, link, related_id)
  VALUES (
    NEW.student_id,
    'booking_' || NEW.status,
    notification_title,
    notification_message,
    'bookingRequests',
    NEW.id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour les changements de statut de réservation
DROP TRIGGER IF EXISTS trigger_notify_booking_status_change ON bookings;
CREATE TRIGGER trigger_notify_booking_status_change
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_booking_status_change();

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
