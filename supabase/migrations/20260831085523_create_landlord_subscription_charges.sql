/*
# Suivi des prélèvements d'abonnement propriétaires et exonérations

1. Nouvelle table `landlord_subscription_charges`
   - Enregistre chaque prélèvement mensuel de 59 € par propriétaire et par bail.
   - Statuts: pending (à prélever), paid (prélevé), failed (échec / impayé), exempted (exonéré), cancelled.
   - Conserve la raison de l'échec, la date de dernière tentative, l'ID de charge Stripe.
   - Contrainte unique sur (landlord_id, lease_id, period_month) pour éviter les doublons.

2. Colonnes ajoutées à `profiles`
   - `subscription_exempt` (boolean, défaut false): exonération permanente des frais Premium.
   - `subscription_exempt_reason` (text): raison interne de l'exonération.
   - `subscription_exempt_until` (timestamptz): fin d'exonération temporaire (null = permanent).

3. Sécurité
   - RLS activée sur `landlord_subscription_charges`.
   - Les administrateurs (role = 'admin') peuvent lire et modifier.
   - Les propriétaires peuvent lire leurs propres lignes.
   - Insert/update réservés aux administrateurs via service role ou admin.
*/

-- 1. Nouvelle table de suivi des prélèvements
CREATE TABLE IF NOT EXISTS landlord_subscription_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lease_id uuid REFERENCES leases(id) ON DELETE SET NULL,
  listing_id uuid,
  period_month text NOT NULL,
  amount integer NOT NULL DEFAULT 5900,
  currency text NOT NULL DEFAULT 'eur',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'exempted', 'cancelled')),
  stripe_charge_id text,
  failure_reason text,
  last_attempt_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(landlord_id, lease_id, period_month)
);

ALTER TABLE landlord_subscription_charges ENABLE ROW LEVEL SECURITY;

-- Policies: admin full access, landlord read-only own rows
DROP POLICY IF EXISTS "admin_read_subscription_charges" ON landlord_subscription_charges;
CREATE POLICY "admin_read_subscription_charges"
  ON landlord_subscription_charges FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "landlord_read_own_charges" ON landlord_subscription_charges;
CREATE POLICY "landlord_read_own_charges"
  ON landlord_subscription_charges FOR SELECT
  TO authenticated
  USING (auth.uid() = landlord_id);

DROP POLICY IF EXISTS "admin_insert_subscription_charges" ON landlord_subscription_charges;
CREATE POLICY "admin_insert_subscription_charges"
  ON landlord_subscription_charges FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_update_subscription_charges" ON landlord_subscription_charges;
CREATE POLICY "admin_update_subscription_charges"
  ON landlord_subscription_charges FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_lsc_landlord_id ON landlord_subscription_charges(landlord_id);
CREATE INDEX IF NOT EXISTS idx_lsc_lease_id ON landlord_subscription_charges(lease_id);
CREATE INDEX IF NOT EXISTS idx_lsc_status ON landlord_subscription_charges(status);
CREATE INDEX IF NOT EXISTS idx_lsc_period_month ON landlord_subscription_charges(period_month);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_lsc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lsc_updated_at ON landlord_subscription_charges;
CREATE TRIGGER trg_lsc_updated_at
  BEFORE UPDATE ON landlord_subscription_charges
  FOR EACH ROW
  EXECUTE FUNCTION update_lsc_updated_at();

-- 2. Colonnes d'exonération sur profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_exempt boolean NOT NULL DEFAULT false;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_exempt_reason text;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_exempt_until timestamptz;

-- Permettre aux admins de mettre à jour l'exonération (déjà couvert par la policy admin existante,
-- mais on s'assure que la colonne est visible)
