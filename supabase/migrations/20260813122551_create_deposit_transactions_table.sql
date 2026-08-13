/*
# Suivi des cautions (deposit_transactions)

## Contexte
Cette table centralise le suivi de chaque caution (depot de garantie) encaissee sur la plateforme.
Elle permet aux proprietaires de gerer les remboursements (totaux ou partiels avec retenue),
et aux etudiants, managers et admins de consulter le statut de chaque caution.

## Nouvelle table: deposit_transactions

- `id` (uuid, primary key)
- `booking_id` (uuid, references bookings, NOT NULL) - La reservation associee
- `listing_id` (uuid, references listings, NOT NULL) - L'annonce associee
- `landlord_id` (uuid, references profiles, NOT NULL) - Le proprietaire
- `student_id` (uuid, references profiles, NOT NULL) - L'etudiant
- `deposit_amount` (numeric(10,2), NOT NULL) - Montant total de la caution encaissee
- `retained_amount` (numeric(10,2), DEFAULT 0) - Montant retenu par le proprietaire
- `refunded_amount` (numeric(10,2), DEFAULT 0) - Montant rembourse a l'etudiant
- `retention_reason` (text, nullable) - Motif de la retenue
- `status` (text, NOT NULL, CHECK IN ('collected', 'refunding', 'refunded', 'retained'))
  - 'collected': caution encaissee, en attente de remboursement
  - 'refunding': remboursement en cours
  - 'refunded': caution entierement remboursee
  - 'retained': caution partiellement retenue et le reste rembourse
- `stripe_payment_intent_id` (text, nullable) - Lien vers le paiement Stripe original
- `stripe_refund_id` (text, nullable) - ID du remboursement Stripe
- `collected_at` (timestamptz, NOT NULL) - Date d'encaissement
- `refunded_at` (timestamptz, nullable) - Date de remboursement
- `created_at` (timestamptz, DEFAULT now())
- `updated_at` (timestamptz, DEFAULT now())

## Securite (RLS)

- RLS active sur deposit_transactions
- SELECT: les proprietaires voient leurs cautions, les etudiants voient leurs cautions,
  les managers voient les cautions des annonces qui leur sont attribuees, les admins voient tout
- INSERT: uniquement via service role (edge function) - pas de politique pour authenticated
- UPDATE: uniquement le proprietaire peut modifier ses cautions (statut, retenue, remboursement)

## Remplissage initial

- Insertion automatique des cautions existantes depuis les bookings qui ont un deposit_amount > 0
  et un payment_status = 'completed'

## Index

- Index sur landlord_id pour les requetes proprietaire
- Index sur student_id pour les requetes etudiant
- Index sur listing_id pour les requetes manager
- Index sur status pour les filtres
*/

CREATE TABLE IF NOT EXISTS deposit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  landlord_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  deposit_amount numeric(10, 2) NOT NULL,
  retained_amount numeric(10, 2) NOT NULL DEFAULT 0,
  refunded_amount numeric(10, 2) NOT NULL DEFAULT 0,
  retention_reason text,
  status text NOT NULL DEFAULT 'collected' CHECK (status IN ('collected', 'refunding', 'refunded', 'retained')),
  stripe_payment_intent_id text,
  stripe_refund_id text,
  collected_at timestamptz NOT NULL DEFAULT now(),
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE deposit_transactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_deposit_transactions_landlord_id ON deposit_transactions(landlord_id);
CREATE INDEX IF NOT EXISTS idx_deposit_transactions_student_id ON deposit_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_deposit_transactions_listing_id ON deposit_transactions(listing_id);
CREATE INDEX IF NOT EXISTS idx_deposit_transactions_status ON deposit_transactions(status);

-- Policy: landlords can SELECT their own deposits
DROP POLICY IF EXISTS "select_own_deposits" ON deposit_transactions;
CREATE POLICY "select_own_deposits"
ON deposit_transactions FOR SELECT
TO authenticated
USING (auth.uid() = landlord_id);

-- Policy: students can SELECT their own deposits
DROP POLICY IF EXISTS "select_student_deposits" ON deposit_transactions;
CREATE POLICY "select_student_deposits"
ON deposit_transactions FOR SELECT
TO authenticated
USING (auth.uid() = student_id);

-- Policy: managers can SELECT deposits for listings assigned to them
DROP POLICY IF EXISTS "select_manager_deposits" ON deposit_transactions;
CREATE POLICY "select_manager_deposits"
ON deposit_transactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM manager_assignments
    WHERE manager_assignments.listing_id = deposit_transactions.listing_id
    AND manager_assignments.manager_id = auth.uid()
  )
);

-- Policy: admins can SELECT all deposits
DROP POLICY IF EXISTS "select_admin_deposits" ON deposit_transactions;
CREATE POLICY "select_admin_deposits"
ON deposit_transactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy: landlords can UPDATE their own deposits (status, retention, refund)
DROP POLICY IF EXISTS "update_own_deposits" ON deposit_transactions;
CREATE POLICY "update_own_deposits"
ON deposit_transactions FOR UPDATE
TO authenticated
USING (auth.uid() = landlord_id)
WITH CHECK (auth.uid() = landlord_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_deposit_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_deposit_transactions_updated_at ON deposit_transactions;
CREATE TRIGGER trigger_deposit_transactions_updated_at
BEFORE UPDATE ON deposit_transactions
FOR EACH ROW
EXECUTE FUNCTION update_deposit_transactions_updated_at();

-- Populate from existing bookings with deposits
INSERT INTO deposit_transactions (booking_id, listing_id, landlord_id, student_id, deposit_amount, status, stripe_payment_intent_id, collected_at)
SELECT
  b.id,
  b.listing_id,
  l.landlord_id,
  b.student_id,
  b.deposit_amount,
  'collected',
  b.stripe_payment_intent_id,
  b.created_at
FROM bookings b
JOIN listings l ON l.id = b.listing_id
WHERE b.deposit_amount > 0
  AND b.payment_status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM deposit_transactions dt WHERE dt.booking_id = b.id
  );
