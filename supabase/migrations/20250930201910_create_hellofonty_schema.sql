/*
  # Schéma HELLOFONTY - Plateforme de logement étudiant INSEAD

  ## 1. Tables Principales
  
  ### `profiles`
  - `id` (uuid, clé primaire, référence auth.users)
  - `role` (text) : 'student' ou 'landlord'
  - `first_name` (text)
  - `last_name` (text)
  - `phone` (text, optionnel)
  - `avatar_url` (text, optionnel)
  - `is_verified` (boolean) : vérification étudiant INSEAD
  - `verification_document_url` (text, optionnel) : lien vers le PDF d'attestation
  - `preferred_language` (text) : 'fr' ou 'en'
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `listings`
  - `id` (uuid, clé primaire)
  - `landlord_id` (uuid, référence profiles)
  - `title` (text)
  - `description` (text)
  - `property_type` (text) : 'apartment', 'house', 'room', 'studio'
  - `address` (text)
  - `city` (text)
  - `postal_code` (text)
  - `latitude` (decimal, optionnel)
  - `longitude` (decimal, optionnel)
  - `price_per_month` (decimal) : prix en euros
  - `bedrooms` (integer)
  - `bathrooms` (integer)
  - `max_guests` (integer)
  - `amenities` (jsonb) : tableau d'équipements
  - `is_active` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `listing_images`
  - `id` (uuid, clé primaire)
  - `listing_id` (uuid, référence listings)
  - `image_url` (text)
  - `display_order` (integer)
  - `created_at` (timestamptz)

  ### `availability_calendar`
  - `id` (uuid, clé primaire)
  - `listing_id` (uuid, référence listings)
  - `date` (date)
  - `is_available` (boolean)
  - `created_at` (timestamptz)

  ### `favorites`
  - `id` (uuid, clé primaire)
  - `student_id` (uuid, référence profiles)
  - `listing_id` (uuid, référence listings)
  - `created_at` (timestamptz)
  - Contrainte unique sur (student_id, listing_id)

  ### `messages`
  - `id` (uuid, clé primaire)
  - `sender_id` (uuid, référence profiles)
  - `recipient_id` (uuid, référence profiles)
  - `listing_id` (uuid, référence listings, optionnel)
  - `content` (text)
  - `is_read` (boolean)
  - `created_at` (timestamptz)

  ## 2. Sécurité RLS (Row Level Security)
  
  Toutes les tables ont RLS activé avec des politiques restrictives :
  - Les profils sont visibles par tous les utilisateurs authentifiés
  - Chaque utilisateur peut uniquement modifier son propre profil
  - Les annonces sont visibles par tous, modifiables uniquement par le propriétaire
  - Les favoris sont privés à chaque étudiant
  - Les messages sont privés entre expéditeur et destinataire

  ## 3. Indexes
  
  - Index sur listing.landlord_id pour performance
  - Index sur availability_calendar(listing_id, date)
  - Index sur messages(sender_id, recipient_id)
*/

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('student', 'landlord')),
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  avatar_url text,
  is_verified boolean DEFAULT false,
  verification_document_url text,
  preferred_language text DEFAULT 'fr' CHECK (preferred_language IN ('fr', 'en')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profils visibles par tous les utilisateurs authentifiés"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Utilisateurs peuvent créer leur propre profil"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Utilisateurs peuvent modifier leur propre profil"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Table listings
CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  landlord_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  property_type text NOT NULL CHECK (property_type IN ('apartment', 'house', 'room', 'studio')),
  address text NOT NULL,
  city text NOT NULL,
  postal_code text NOT NULL,
  latitude decimal(10, 8),
  longitude decimal(11, 8),
  price_per_month decimal(10, 2) NOT NULL CHECK (price_per_month >= 0),
  bedrooms integer NOT NULL CHECK (bedrooms >= 0),
  bathrooms integer NOT NULL CHECK (bathrooms >= 0),
  max_guests integer NOT NULL CHECK (max_guests > 0),
  amenities jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_listings_landlord_id ON listings(landlord_id);
CREATE INDEX IF NOT EXISTS idx_listings_city ON listings(city);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price_per_month);

CREATE POLICY "Annonces visibles par tous les utilisateurs authentifiés"
  ON listings FOR SELECT
  TO authenticated
  USING (is_active = true OR landlord_id = auth.uid());

CREATE POLICY "Propriétaires peuvent créer des annonces"
  ON listings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = landlord_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'landlord'
    )
  );

CREATE POLICY "Propriétaires peuvent modifier leurs annonces"
  ON listings FOR UPDATE
  TO authenticated
  USING (auth.uid() = landlord_id)
  WITH CHECK (auth.uid() = landlord_id);

CREATE POLICY "Propriétaires peuvent supprimer leurs annonces"
  ON listings FOR DELETE
  TO authenticated
  USING (auth.uid() = landlord_id);

-- Table listing_images
CREATE TABLE IF NOT EXISTS listing_images (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE listing_images ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_listing_images_listing_id ON listing_images(listing_id);

CREATE POLICY "Images visibles par tous les utilisateurs authentifiés"
  ON listing_images FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_images.listing_id
    )
  );

CREATE POLICY "Propriétaires peuvent ajouter des images à leurs annonces"
  ON listing_images FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_images.listing_id
      AND listings.landlord_id = auth.uid()
    )
  );

CREATE POLICY "Propriétaires peuvent supprimer les images de leurs annonces"
  ON listing_images FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_images.listing_id
      AND listings.landlord_id = auth.uid()
    )
  );

-- Table availability_calendar
CREATE TABLE IF NOT EXISTS availability_calendar (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  date date NOT NULL,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(listing_id, date)
);

ALTER TABLE availability_calendar ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_availability_listing_date ON availability_calendar(listing_id, date);

CREATE POLICY "Calendrier visible par tous les utilisateurs authentifiés"
  ON availability_calendar FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Propriétaires peuvent gérer le calendrier de leurs annonces"
  ON availability_calendar FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = availability_calendar.listing_id
      AND listings.landlord_id = auth.uid()
    )
  );

CREATE POLICY "Propriétaires peuvent modifier le calendrier de leurs annonces"
  ON availability_calendar FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = availability_calendar.listing_id
      AND listings.landlord_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = availability_calendar.listing_id
      AND listings.landlord_id = auth.uid()
    )
  );

-- Table favorites
CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, listing_id)
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_favorites_student_id ON favorites(student_id);
CREATE INDEX IF NOT EXISTS idx_favorites_listing_id ON favorites(listing_id);

CREATE POLICY "Étudiants peuvent voir leurs propres favoris"
  ON favorites FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Étudiants peuvent ajouter des favoris"
  ON favorites FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = student_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'student'
    )
  );

CREATE POLICY "Étudiants peuvent supprimer leurs favoris"
  ON favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = student_id);

-- Table messages
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_messages_sender_recipient ON messages(sender_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_listing_id ON messages(listing_id);

CREATE POLICY "Utilisateurs peuvent voir leurs messages"
  ON messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Utilisateurs peuvent envoyer des messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Destinataires peuvent marquer les messages comme lus"
  ON messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour listings
DROP TRIGGER IF EXISTS update_listings_updated_at ON listings;
CREATE TRIGGER update_listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();