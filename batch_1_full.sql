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
CREATE INDEX IF NOT EXISTS idx_messages_booking_id ON messages(booking_id);/*
  # Ajouter une politique d'insertion pour les notifications

  1. Modifications
    - Ajoute une politique INSERT pour permettre aux utilisateurs authentifiés de créer des notifications pour d'autres utilisateurs
    - Nécessaire pour que les étudiants puissent créer des notifications pour les propriétaires lors de l'annulation de demandes
  
  2. Sécurité
    - Permet uniquement aux utilisateurs authentifiés de créer des notifications
    - Les utilisateurs peuvent toujours uniquement voir et modifier leurs propres notifications
*/

-- Ajouter la politique INSERT pour les notifications
CREATE POLICY "Authenticated users can create notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);/*
  # Add GPS coordinates to listings

  1. Changes
    - Add `latitude` column to listings table (decimal type)
    - Add `longitude` column to listings table (decimal type)
    - Set default values for existing listings to Fontainebleau center
  
  2. Notes
    - Coordinates will be used to display listings on the interactive map
    - Latitude and longitude are optional fields
    - Default coordinates point to Fontainebleau center (48.4084, 2.7007)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE listings ADD COLUMN latitude decimal(10, 8) DEFAULT 48.4084;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE listings ADD COLUMN longitude decimal(11, 8) DEFAULT 2.7007;
  END IF;
END $$;
/*
  # Ajouter la vérification de téléphone par SMS
  
  1. Modifications
    - Ajouter `phone_verified` (booléen) aux profils pour suivre l'état de vérification
    - Ajouter `phone_verification_code` (texte) pour stocker le code de vérification temporaire
    - Ajouter `phone_verification_expires_at` (timestamp) pour l'expiration du code
    - Ajouter une table `phone_verification_attempts` pour limiter les tentatives
  
  2. Sécurité
    - Les codes de vérification expirent après 10 minutes
    - Maximum 5 tentatives par numéro de téléphone par heure
    - Les codes sont hachés avant stockage
  
  3. Tables
    - `phone_verification_attempts` : suivi des tentatives de vérification
*/

-- Ajouter les colonnes de vérification de téléphone au profil
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'phone_verified'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone_verified boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'phone_verification_code'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone_verification_code text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'phone_verification_expires_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone_verification_expires_at timestamptz;
  END IF;
END $$;

-- Créer une table pour suivre les tentatives de vérification
CREATE TABLE IF NOT EXISTS phone_verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  attempted_at timestamptz DEFAULT now(),
  success boolean DEFAULT false,
  ip_address text
);

ALTER TABLE phone_verification_attempts ENABLE ROW LEVEL SECURITY;

-- Policy pour permettre l'insertion des tentatives
CREATE POLICY "Allow insert verification attempts"
  ON phone_verification_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy pour permettre la lecture de ses propres tentatives
CREATE POLICY "Users can read own attempts"
  ON phone_verification_attempts
  FOR SELECT
  TO authenticated
  USING (phone IN (SELECT phone FROM profiles WHERE id = auth.uid()));

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_phone_verification_attempts_phone 
  ON phone_verification_attempts(phone, attempted_at DESC);

-- Fonction pour nettoyer les anciennes tentatives (plus de 24h)
CREATE OR REPLACE FUNCTION cleanup_old_verification_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM phone_verification_attempts 
  WHERE attempted_at < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;/*
  # Créer le système de gestion des documents étudiants
  
  1. Nouvelle table
    - `student_documents` : stockage des documents des étudiants
      - `id` (uuid, primary key)
      - `student_id` (uuid, foreign key vers profiles)
      - `booking_id` (uuid, nullable, foreign key vers bookings)
      - `document_type` (text) : id_card_front, id_card_back, accommodation_certificate, insurance_certificate, lease_copy, inventory_copy
      - `file_url` (text) : URL du fichier dans le storage
      - `file_name` (text) : nom original du fichier
      - `uploaded_at` (timestamptz)
      - `status` (text) : pending, approved, rejected
      - `admin_notes` (text, nullable)
  
  2. Sécurité
    - Enable RLS sur student_documents
    - Les étudiants peuvent voir et uploader leurs propres documents
    - Les propriétaires peuvent voir les documents des étudiants qui ont réservé chez eux
  
  3. Storage
    - Créer un bucket pour les documents étudiants
    - Policies pour l'upload et la lecture sécurisée
*/

-- Créer la table des documents étudiants
CREATE TABLE IF NOT EXISTS student_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  document_type text NOT NULL CHECK (document_type IN (
    'id_card_front',
    'id_card_back', 
    'accommodation_certificate',
    'insurance_certificate',
    'lease_copy',
    'inventory_copy'
  )),
  file_url text NOT NULL,
  file_name text NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE student_documents ENABLE ROW LEVEL SECURITY;

-- Policy : Les étudiants peuvent voir leurs propres documents
CREATE POLICY "Students can view own documents"
  ON student_documents
  FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

-- Policy : Les étudiants peuvent uploader leurs documents
CREATE POLICY "Students can upload own documents"
  ON student_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

-- Policy : Les étudiants peuvent mettre à jour leurs documents
CREATE POLICY "Students can update own documents"
  ON student_documents
  FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Policy : Les étudiants peuvent supprimer leurs documents
CREATE POLICY "Students can delete own documents"
  ON student_documents
  FOR DELETE
  TO authenticated
  USING (student_id = auth.uid());

-- Policy : Les propriétaires peuvent voir les documents des étudiants qui ont réservé
CREATE POLICY "Landlords can view documents of their tenants"
  ON student_documents
  FOR SELECT
  TO authenticated
  USING (
    booking_id IN (
      SELECT b.id FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE l.landlord_id = auth.uid()
    )
  );

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_student_documents_student_id 
  ON student_documents(student_id);

CREATE INDEX IF NOT EXISTS idx_student_documents_booking_id 
  ON student_documents(booking_id);

CREATE INDEX IF NOT EXISTS idx_student_documents_type 
  ON student_documents(document_type);

-- Créer le bucket de storage pour les documents étudiants
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-documents', 'student-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policy storage : Les étudiants peuvent uploader leurs documents
CREATE POLICY "Students can upload their documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'student-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy storage : Les étudiants peuvent voir leurs documents
CREATE POLICY "Students can view their documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'student-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy storage : Les propriétaires peuvent voir les documents de leurs locataires
CREATE POLICY "Landlords can view tenant documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'student-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT b.student_id::text
      FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE l.landlord_id = auth.uid()
    )
  );

-- Policy storage : Les étudiants peuvent mettre à jour leurs documents
CREATE POLICY "Students can update their documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'student-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy storage : Les étudiants peuvent supprimer leurs documents
CREATE POLICY "Students can delete their documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'student-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );/*
  # Créer le système de gestion des documents propriétaires
  
  1. Nouvelle table
    - `landlord_documents` : stockage des documents des propriétaires
      - `id` (uuid, primary key)
      - `landlord_id` (uuid, foreign key vers profiles)
      - `listing_id` (uuid, nullable, foreign key vers listings) : pour lier les docs signés à un logement spécifique
      - `document_type` (text) : 
        * Documents de vérification : id_card, kbis, property_tax
        * Documents signés par logement : lease_copy, inventory_copy
        * Assurances des locataires : tenant_insurance
      - `file_url` (text) : URL du fichier dans le storage
      - `file_name` (text) : nom original du fichier
      - `tenant_id` (uuid, nullable) : pour identifier le locataire concerné (utile pour les assurances)
      - `uploaded_at` (timestamptz)
      - `status` (text) : pending, approved, rejected
      - `admin_notes` (text, nullable)
  
  2. Sécurité
    - Enable RLS sur landlord_documents
    - Les propriétaires peuvent voir et uploader leurs propres documents
    - Les propriétaires peuvent voir les documents liés à leurs logements
    - Les étudiants peuvent voir certains documents du propriétaire (bail signé, état des lieux)
  
  3. Storage
    - Créer un bucket pour les documents propriétaires
    - Policies pour l'upload et la lecture sécurisée
*/

-- Créer la table des documents propriétaires
CREATE TABLE IF NOT EXISTS landlord_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN (
    'id_card',
    'kbis',
    'property_tax',
    'lease_copy',
    'inventory_copy',
    'tenant_insurance'
  )),
  file_url text NOT NULL,
  file_name text NOT NULL,
  tenant_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE landlord_documents ENABLE ROW LEVEL SECURITY;

-- Policy : Les propriétaires peuvent voir leurs propres documents
CREATE POLICY "Landlords can view own documents"
  ON landlord_documents
  FOR SELECT
  TO authenticated
  USING (landlord_id = auth.uid());

-- Policy : Les propriétaires peuvent uploader leurs documents
CREATE POLICY "Landlords can upload own documents"
  ON landlord_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (landlord_id = auth.uid());

-- Policy : Les propriétaires peuvent mettre à jour leurs documents
CREATE POLICY "Landlords can update own documents"
  ON landlord_documents
  FOR UPDATE
  TO authenticated
  USING (landlord_id = auth.uid())
  WITH CHECK (landlord_id = auth.uid());

-- Policy : Les propriétaires peuvent supprimer leurs documents
CREATE POLICY "Landlords can delete own documents"
  ON landlord_documents
  FOR DELETE
  TO authenticated
  USING (landlord_id = auth.uid());

-- Policy : Les étudiants peuvent voir les documents signés liés à leur réservation
CREATE POLICY "Tenants can view signed documents for their bookings"
  ON landlord_documents
  FOR SELECT
  TO authenticated
  USING (
    document_type IN ('lease_copy', 'inventory_copy') AND
    listing_id IN (
      SELECT b.listing_id FROM bookings b
      WHERE b.student_id = auth.uid()
      AND b.status = 'approved'
    )
  );

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_landlord_documents_landlord_id 
  ON landlord_documents(landlord_id);

CREATE INDEX IF NOT EXISTS idx_landlord_documents_listing_id 
  ON landlord_documents(listing_id);

CREATE INDEX IF NOT EXISTS idx_landlord_documents_type 
  ON landlord_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_landlord_documents_tenant_id 
  ON landlord_documents(tenant_id);

-- Créer le bucket de storage pour les documents propriétaires
INSERT INTO storage.buckets (id, name, public)
VALUES ('landlord-documents', 'landlord-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policy storage : Les propriétaires peuvent uploader leurs documents
CREATE POLICY "Landlords can upload their documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'landlord-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy storage : Les propriétaires peuvent voir leurs documents
CREATE POLICY "Landlords can view their documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'landlord-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy storage : Les étudiants peuvent voir les documents signés de leurs propriétaires
CREATE POLICY "Tenants can view landlord signed documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'landlord-documents' AND
    (storage.foldername(name))[1] IN (
      SELECT l.landlord_id::text
      FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE b.student_id = auth.uid()
      AND b.status = 'approved'
    )
  );

-- Policy storage : Les propriétaires peuvent mettre à jour leurs documents
CREATE POLICY "Landlords can update their documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'landlord-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy storage : Les propriétaires peuvent supprimer leurs documents
CREATE POLICY "Landlords can delete their documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'landlord-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );/*
  # Add Admin Role to Profiles

  1. Changes
    - Modify the `role` column check constraint to include 'admin'
    - Profiles can now have role: 'student', 'landlord', or 'admin'
  
  2. Security
    - No RLS changes needed as admins inherit from existing policies
    - Admin access will be controlled at the application level
*/

-- Drop the existing check constraint
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'profiles_role_check'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
  END IF;
END $$;

-- Add the new check constraint with admin role
ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role = ANY (ARRAY['student'::text, 'landlord'::text, 'admin'::text]));/*
  # Permettre aux admins de modifier les profils

  1. Modifications
    - Ajoute une politique permettant aux utilisateurs avec le rôle 'admin' de mettre à jour tous les profils
    - Nécessaire pour que les admins puissent approuver/rejeter les demandes de vérification

  2. Sécurité
    - Seuls les utilisateurs avec role = 'admin' peuvent modifier les profils des autres
    - Les utilisateurs normaux peuvent toujours modifier leur propre profil (politique existante)
*/

-- Ajouter une politique pour permettre aux admins de mettre à jour tous les profils
CREATE POLICY "Admins peuvent modifier tous les profils"
  ON profiles
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
  );/*
  # Créer les fonctions d'analytique pour le tableau de bord admin

  1. Nouvelles fonctions
    - `get_daily_user_growth(days)` - Retourne le nombre de nouveaux utilisateurs par jour
    - `get_daily_listing_growth(days)` - Retourne le nombre de nouvelles annonces par jour
    - `get_daily_booking_growth(days)` - Retourne le nombre de nouvelles réservations par jour
    - `get_daily_activity(days)` - Retourne l'activité quotidienne combinée

  2. Sécurité
    - Ces fonctions sont accessibles uniquement aux utilisateurs authentifiés
    - Elles ne retournent que des données agrégées (pas de données personnelles)
*/

-- Fonction pour obtenir la croissance quotidienne des utilisateurs
CREATE OR REPLACE FUNCTION get_daily_user_growth(days integer DEFAULT 30)
RETURNS TABLE (date date, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(created_at) as date,
    COUNT(*) as count
  FROM profiles
  WHERE created_at >= CURRENT_DATE - (days || ' days')::interval
  GROUP BY DATE(created_at)
  ORDER BY date DESC;
END;
$$;

-- Fonction pour obtenir la croissance quotidienne des annonces
CREATE OR REPLACE FUNCTION get_daily_listing_growth(days integer DEFAULT 30)
RETURNS TABLE (date date, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(created_at) as date,
    COUNT(*) as count
  FROM listings
  WHERE created_at >= CURRENT_DATE - (days || ' days')::interval
  GROUP BY DATE(created_at)
  ORDER BY date DESC;
END;
$$;

-- Fonction pour obtenir la croissance quotidienne des réservations
CREATE OR REPLACE FUNCTION get_daily_booking_growth(days integer DEFAULT 30)
RETURNS TABLE (date date, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(created_at) as date,
    COUNT(*) as count
  FROM bookings
  WHERE created_at >= CURRENT_DATE - (days || ' days')::interval
  GROUP BY DATE(created_at)
  ORDER BY date DESC;
END;
$$;

-- Fonction pour obtenir l'activité quotidienne combinée
CREATE OR REPLACE FUNCTION get_daily_activity(days integer DEFAULT 30)
RETURNS TABLE (
  date date,
  users bigint,
  listings bigint,
  bookings bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - (days || ' days')::interval,
      CURRENT_DATE,
      '1 day'::interval
    )::date as d
  ),
  user_counts AS (
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM profiles
    WHERE created_at >= CURRENT_DATE - (days || ' days')::interval
    GROUP BY DATE(created_at)
  ),
  listing_counts AS (
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM listings
    WHERE created_at >= CURRENT_DATE - (days || ' days')::interval
    GROUP BY DATE(created_at)
  ),
  booking_counts AS (
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM bookings
    WHERE created_at >= CURRENT_DATE - (days || ' days')::interval
    GROUP BY DATE(created_at)
  )
  SELECT 
    ds.d as date,
    COALESCE(uc.count, 0) as users,
    COALESCE(lc.count, 0) as listings,
    COALESCE(bc.count, 0) as bookings
  FROM date_series ds
  LEFT JOIN user_counts uc ON ds.d = uc.date
  LEFT JOIN listing_counts lc ON ds.d = lc.date
  LEFT JOIN booking_counts bc ON ds.d = bc.date
  ORDER BY ds.d DESC;
END;
$$;

-- Accorder les permissions d'exécution aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION get_daily_user_growth(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_listing_growth(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_booking_growth(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_activity(integer) TO authenticated;/*
  # Permettre aux admins de voir tous les messages

  1. Modifications
    - Ajoute une politique permettant aux utilisateurs avec le rôle 'admin' de voir tous les messages
    - Nécessaire pour la fonctionnalité de surveillance des conversations dans le panneau admin

  2. Sécurité
    - Seuls les utilisateurs avec role = 'admin' peuvent voir tous les messages
    - Les utilisateurs normaux peuvent toujours voir uniquement leurs propres messages (politique existante)
*/

-- Ajouter une politique pour permettre aux admins de voir tous les messages
CREATE POLICY "Admins peuvent voir tous les messages"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );/*
  # Remove phone verification system

  1. Changes
    - Remove phone_verified column from profiles table
    - Remove phone_verification_codes table
    - Remove phone_verification_attempts table
    
  2. Notes
    - This migration removes the phone verification system
    - The system will now use email verification only (built-in Supabase auth)
*/

-- Remove phone_verified column from profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone_verified'
  ) THEN
    ALTER TABLE profiles DROP COLUMN phone_verified;
  END IF;
END $$;

-- Drop phone_verification_codes table if exists
DROP TABLE IF EXISTS phone_verification_codes CASCADE;

-- Drop phone_verification_attempts table if exists
DROP TABLE IF EXISTS phone_verification_attempts CASCADE;
