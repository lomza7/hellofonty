/*
  # Création du système de baux (Leases)

  1. Nouvelle table : `leases`
    - `id` (uuid, primary key) - Identifiant unique du bail
    - `listing_id` (uuid, foreign key) - Référence au logement
    - `landlord_id` (uuid, foreign key) - Référence au propriétaire
    - `tenant_id` (uuid, foreign key) - Référence au locataire
    - `start_date` (date) - Date de début du bail
    - `end_date` (date) - Date de fin du bail
    - `monthly_rent` (decimal) - Montant du loyer mensuel
    - `security_deposit` (decimal) - Montant de la caution
    - `charges` (decimal) - Montant des charges
    - `lease_type` (text) - Type de bail (furnished, unfurnished, student, etc.)
    - `status` (text) - Statut (draft, pending_signature, signed, active, terminated, cancelled)
    - `document_url` (text) - URL du document PDF généré
    - `landlord_signature` (jsonb) - Données de signature du propriétaire
    - `tenant_signature` (jsonb) - Données de signature du locataire
    - `signature_request_id` (text) - ID de la demande de signature (API externe)
    - `terms_and_conditions` (text) - Clauses particulières du bail
    - `inventory_included` (boolean) - Si un état des lieux est inclus
    - `created_at` (timestamptz) - Date de création
    - `updated_at` (timestamptz) - Date de mise à jour
    - `signed_at` (timestamptz) - Date de signature complète

  2. Sécurité
    - Enable RLS sur la table `leases`
    - Les propriétaires peuvent créer, lire et modifier leurs baux
    - Les locataires peuvent lire et signer leurs baux
    - Les admins peuvent tout faire
*/

-- Création de la table leases
CREATE TABLE IF NOT EXISTS leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  landlord_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  monthly_rent decimal(10, 2) NOT NULL DEFAULT 0,
  security_deposit decimal(10, 2) NOT NULL DEFAULT 0,
  charges decimal(10, 2) DEFAULT 0,
  lease_type text NOT NULL DEFAULT 'furnished',
  status text NOT NULL DEFAULT 'draft',
  document_url text,
  landlord_signature jsonb,
  tenant_signature jsonb,
  signature_request_id text,
  terms_and_conditions text,
  inventory_included boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  signed_at timestamptz,
  CONSTRAINT valid_dates CHECK (end_date > start_date),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'pending_signature', 'signed', 'active', 'terminated', 'cancelled'))
);

-- Enable RLS
ALTER TABLE leases ENABLE ROW LEVEL SECURITY;

-- Policy: Les propriétaires peuvent voir leurs baux
CREATE POLICY "Landlords can view own leases"
  ON leases FOR SELECT
  TO authenticated
  USING (
    landlord_id = auth.uid()
  );

-- Policy: Les locataires peuvent voir leurs baux
CREATE POLICY "Tenants can view their leases"
  ON leases FOR SELECT
  TO authenticated
  USING (
    tenant_id = auth.uid()
  );

-- Policy: Les propriétaires peuvent créer des baux
CREATE POLICY "Landlords can create leases"
  ON leases FOR INSERT
  TO authenticated
  WITH CHECK (
    landlord_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'landlord'
    )
  );

-- Policy: Les propriétaires peuvent modifier leurs baux non signés
CREATE POLICY "Landlords can update own draft leases"
  ON leases FOR UPDATE
  TO authenticated
  USING (
    landlord_id = auth.uid() AND
    status IN ('draft', 'pending_signature')
  )
  WITH CHECK (
    landlord_id = auth.uid()
  );

-- Policy: Les locataires peuvent signer leurs baux
CREATE POLICY "Tenants can sign their leases"
  ON leases FOR UPDATE
  TO authenticated
  USING (
    tenant_id = auth.uid() AND
    status = 'pending_signature'
  )
  WITH CHECK (
    tenant_id = auth.uid()
  );

-- Policy: Les admins peuvent tout faire
CREATE POLICY "Admins can do everything with leases"
  ON leases FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Les propriétaires peuvent supprimer leurs baux brouillons
CREATE POLICY "Landlords can delete draft leases"
  ON leases FOR DELETE
  TO authenticated
  USING (
    landlord_id = auth.uid() AND
    status = 'draft'
  );

-- Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_leases_landlord ON leases(landlord_id);
CREATE INDEX IF NOT EXISTS idx_leases_tenant ON leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leases_listing ON leases(listing_id);
CREATE INDEX IF NOT EXISTS idx_leases_status ON leases(status);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_leases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at
DROP TRIGGER IF EXISTS update_leases_updated_at_trigger ON leases;
CREATE TRIGGER update_leases_updated_at_trigger
  BEFORE UPDATE ON leases
  FOR EACH ROW
  EXECUTE FUNCTION update_leases_updated_at();
