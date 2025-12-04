/*
  # Amélioration du système de vérification INSEAD
  
  ## Modifications de la table profiles
  
  1. Ajout de nouveaux champs pour le suivi de vérification :
    - `verification_status` : 'pending', 'approved', 'rejected', 'not_submitted'
    - `verification_submitted_at` : date de soumission de la demande
    - `verification_reviewed_at` : date de révision par l'admin
    - `verification_rejection_reason` : raison du rejet si applicable
  
  2. Notes importantes :
    - La photo de profil (avatar_url) devient obligatoire pour la vérification
    - Le champ is_verified reste pour la compatibilité mais sera dérivé du statut
    - Les étudiants peuvent suivre l'état de leur demande en temps réel
*/

-- Ajouter les nouveaux champs pour le suivi de vérification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'verification_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN verification_status text DEFAULT 'not_submitted' 
      CHECK (verification_status IN ('not_submitted', 'pending', 'approved', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'verification_submitted_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN verification_submitted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'verification_reviewed_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN verification_reviewed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'verification_rejection_reason'
  ) THEN
    ALTER TABLE profiles ADD COLUMN verification_rejection_reason text;
  END IF;
END $$;

-- Créer un index pour les recherches par statut de vérification
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON profiles(verification_status);

-- Fonction pour mettre à jour is_verified basé sur verification_status
CREATE OR REPLACE FUNCTION sync_verification_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_verified = (NEW.verification_status = 'approved');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour synchroniser is_verified avec verification_status
DROP TRIGGER IF EXISTS sync_verification_status_trigger ON profiles;
CREATE TRIGGER sync_verification_status_trigger
  BEFORE INSERT OR UPDATE OF verification_status ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_verification_status();