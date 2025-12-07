/*
  # Système de paiement pour les réservations

  1. Modifications de la table bookings
    - `payment_status` (text) - Statut du paiement : pending, completed, expired
    - `payment_deadline` (timestamptz) - Date limite de paiement (7 jours après confirmation)
    - `payment_amount` (numeric) - Montant total à payer
    - `rent_amount` (numeric) - Montant du loyer
    - `deposit_amount` (numeric) - Montant de la caution
    - `service_fee` (numeric) - Frais de service Hellofonty
    - `stripe_payment_intent_id` (text) - ID de l'intention de paiement Stripe

  2. Sécurité
    - Les utilisateurs peuvent voir leurs propres informations de paiement
    - Les propriétaires peuvent voir les paiements de leurs annonces
*/

-- Ajouter les colonnes de paiement
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'expired', 'refunded')),
ADD COLUMN IF NOT EXISTS payment_deadline timestamptz,
ADD COLUMN IF NOT EXISTS payment_amount numeric(10, 2),
ADD COLUMN IF NOT EXISTS rent_amount numeric(10, 2),
ADD COLUMN IF NOT EXISTS deposit_amount numeric(10, 2),
ADD COLUMN IF NOT EXISTS service_fee numeric(10, 2),
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- Créer un index sur payment_status et payment_deadline pour les requêtes
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_deadline ON bookings(payment_deadline) WHERE payment_deadline IS NOT NULL;

-- Fonction pour définir automatiquement la deadline de paiement quand le statut passe à confirmed
CREATE OR REPLACE FUNCTION set_payment_deadline()
RETURNS TRIGGER AS $$
BEGIN
  -- Si le statut passe à confirmed et qu'il n'y a pas encore de deadline
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' AND NEW.payment_deadline IS NULL THEN
    NEW.payment_deadline := NOW() + INTERVAL '7 days';
    NEW.payment_status := 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour appeler la fonction
DROP TRIGGER IF EXISTS trigger_set_payment_deadline ON bookings;
CREATE TRIGGER trigger_set_payment_deadline
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_payment_deadline();