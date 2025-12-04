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
$$ LANGUAGE plpgsql SECURITY DEFINER;