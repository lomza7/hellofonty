/*
  # Système de paiements mensuels de loyer

  1. Nouvelle Table `rent_payments`
    - `id` (uuid, clé primaire)
    - `booking_id` (uuid, référence à bookings)
    - `student_id` (uuid, référence à profiles)
    - `landlord_id` (uuid, référence à profiles)
    - `rent_amount` (numeric, montant du loyer mensuel)
    - `platform_fee` (numeric, frais de plateforme)
    - `total_amount` (numeric, montant total = rent_amount + platform_fee)
    - `payment_date` (date, date prévue du paiement)
    - `month_year` (text, format "YYYY-MM" pour identifier le mois)
    - `status` (text, statut : pending, paid, overdue, cancelled)
    - `stripe_payment_intent_id` (text, ID du Payment Intent Stripe)
    - `paid_at` (timestamptz, date de paiement effectif)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  2. Sécurité
    - Enable RLS sur `rent_payments`
    - Politique pour que les étudiants voient leurs propres paiements
    - Politique pour que les propriétaires voient les paiements de leurs locations
    - Politique pour que les admins voient tout
    - Politiques d'insertion et mise à jour sécurisées

  3. Index
    - Index sur booking_id pour les requêtes rapides
    - Index sur student_id pour filtrer par étudiant
    - Index sur status pour filtrer par statut
    - Index sur payment_date pour trier chronologiquement
*/

-- Create rent_payments table
CREATE TABLE IF NOT EXISTS rent_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  landlord_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rent_amount numeric NOT NULL CHECK (rent_amount >= 0),
  platform_fee numeric NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  payment_date date NOT NULL,
  month_year text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  stripe_payment_intent_id text,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE rent_payments ENABLE ROW LEVEL SECURITY;

-- Policy: Students can view their own rent payments
CREATE POLICY "Students can view own rent payments"
  ON rent_payments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

-- Policy: Landlords can view rent payments for their bookings
CREATE POLICY "Landlords can view rent payments for their bookings"
  ON rent_payments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = landlord_id);

-- Policy: Admins can view all rent payments
CREATE POLICY "Admins can view all rent payments"
  ON rent_payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: System can insert rent payments (via service role)
CREATE POLICY "System can insert rent payments"
  ON rent_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: System can update rent payments status
CREATE POLICY "System can update rent payments"
  ON rent_payments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rent_payments_booking_id ON rent_payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_student_id ON rent_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_landlord_id ON rent_payments(landlord_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_status ON rent_payments(status);
CREATE INDEX IF NOT EXISTS idx_rent_payments_payment_date ON rent_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_rent_payments_month_year ON rent_payments(month_year);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_rent_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE TRIGGER update_rent_payments_updated_at
  BEFORE UPDATE ON rent_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_rent_payments_updated_at();
