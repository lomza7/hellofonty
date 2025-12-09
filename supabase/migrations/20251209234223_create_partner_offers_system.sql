/*
  # Système d'offres partenaires

  1. Nouvelle table
    - `partner_offers`
      - `id` (uuid, clé primaire)
      - `title` (text) - Titre de l'offre
      - `description` (text) - Description détaillée
      - `company_name` (text) - Nom du partenaire
      - `image_url` (text) - URL de l'image de l'offre
      - `cta_text` (text) - Texte du bouton d'action
      - `cta_link` (text) - Lien du bouton d'action
      - `is_active` (boolean) - Afficher ou non l'offre
      - `display_order` (integer) - Ordre d'affichage
      - `verified` (boolean) - Badge vérifié
      - `target_audience` (text) - Cible: 'landlord', 'student', ou 'both'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Sécurité
    - Enable RLS sur `partner_offers`
    - Les utilisateurs authentifiés peuvent lire les offres actives
    - Seuls les admins peuvent créer/modifier/supprimer
*/

CREATE TABLE IF NOT EXISTS partner_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  company_name text NOT NULL,
  image_url text,
  cta_text text NOT NULL DEFAULT 'En savoir plus',
  cta_link text NOT NULL,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  verified boolean DEFAULT true,
  target_audience text DEFAULT 'both' CHECK (target_audience IN ('landlord', 'student', 'both')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE partner_offers ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs authentifiés peuvent voir les offres actives
CREATE POLICY "Authenticated users can view active partner offers"
  ON partner_offers
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Les admins peuvent tout faire
CREATE POLICY "Admins can view all partner offers"
  ON partner_offers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert partner offers"
  ON partner_offers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update partner offers"
  ON partner_offers
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

CREATE POLICY "Admins can delete partner offers"
  ON partner_offers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_partner_offers_active ON partner_offers(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_partner_offers_target ON partner_offers(target_audience, is_active);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_partner_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER partner_offers_updated_at
  BEFORE UPDATE ON partner_offers
  FOR EACH ROW
  EXECUTE FUNCTION update_partner_offers_updated_at();

-- Insérer quelques offres d'exemple
INSERT INTO partner_offers (title, description, company_name, cta_text, cta_link, display_order, target_audience) VALUES
('Assurance habitation en ligne', 'Protégez votre logement avec une assurance 100% digitale. Souscription en 3 minutes, résiliation à tout moment.', 'QOVER', 'Obtenir un devis', 'https://www.qover.com', 1, 'landlord'),
('Place gratuite - Concert de Jazz', 'Gagnez une place gratuite pour le prochain concert de Jazz à Fontainebleau. Offre exclusive pour nos utilisateurs.', 'Jazz à Fontainebleau', 'Réserver ma place', '#', 2, 'both'),
('Crédit étudiant avantageux', 'Financez vos études avec des taux préférentiels. Sans frais de dossier pour les étudiants INSEAD.', 'BNP Paribas', 'Simuler mon prêt', '#', 3, 'student')
ON CONFLICT DO NOTHING;