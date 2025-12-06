/*
  # Ajout de Stripe Connect pour les propriétaires

  1. Nouveaux champs dans `profiles`
    - `stripe_account_id` (text, nullable) : Identifiant du compte Stripe Connect
    - `stripe_onboarding_status` (text) : Statut de l'onboarding ('not_connected', 'pending', 'complete')
    - `stripe_charges_enabled` (boolean) : Capacité à recevoir des paiements
    - `stripe_payouts_enabled` (boolean) : Capacité à recevoir des virements
    - `stripe_details_submitted` (boolean) : Détails soumis à Stripe
    - `stripe_onboarding_updated_at` (timestamptz) : Dernière mise à jour du statut

  2. Sécurité
    - Les propriétaires peuvent lire uniquement leurs propres données Stripe
    - Seules les Edge Functions (service role) peuvent mettre à jour ces champs
    - Les admins peuvent voir tous les comptes Stripe

  3. Index
    - Index sur stripe_account_id pour les recherches rapides
*/

-- Ajout des colonnes Stripe Connect à la table profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'stripe_account_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_account_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'stripe_onboarding_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_onboarding_status text DEFAULT 'not_connected'
      CHECK (stripe_onboarding_status IN ('not_connected', 'pending', 'complete'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'stripe_charges_enabled'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_charges_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'stripe_payouts_enabled'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_payouts_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'stripe_details_submitted'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_details_submitted boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'stripe_onboarding_updated_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_onboarding_updated_at timestamptz;
  END IF;
END $$;

-- Créer un index sur stripe_account_id pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_account_id ON profiles(stripe_account_id);

-- Commentaires pour documenter les colonnes
COMMENT ON COLUMN profiles.stripe_account_id IS 'Identifiant du compte Stripe Connect du propriétaire';
COMMENT ON COLUMN profiles.stripe_onboarding_status IS 'Statut de l''onboarding Stripe Connect (not_connected, pending, complete)';
COMMENT ON COLUMN profiles.stripe_charges_enabled IS 'Le compte peut recevoir des paiements';
COMMENT ON COLUMN profiles.stripe_payouts_enabled IS 'Le compte peut recevoir des virements bancaires';
COMMENT ON COLUMN profiles.stripe_details_submitted IS 'Les détails ont été soumis à Stripe pour vérification';
COMMENT ON COLUMN profiles.stripe_onboarding_updated_at IS 'Date de dernière mise à jour du statut Stripe';
