/*
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
CHECK (role = ANY (ARRAY['student'::text, 'landlord'::text, 'admin'::text]));
/*
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
  );
/*
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
GRANT EXECUTE ON FUNCTION get_daily_activity(integer) TO authenticated;
/*
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
  );
/*
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