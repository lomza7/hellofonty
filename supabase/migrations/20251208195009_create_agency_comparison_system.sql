/*
  # Système de comparaison Hellofonty VS Agences Immobilières
  
  1. Nouvelle table
    - `agency_comparison_features`
      - `id` (uuid, clé primaire)
      - `feature_fr` (text) - Nom du critère en français
      - `feature_en` (text) - Nom du critère en anglais
      - `hellofonty_has` (boolean) - Si Hellofonty propose ce service
      - `hellofonty_details_fr` (text) - Détails pour Hellofonty en français (ex: "0€ - 99€/an")
      - `hellofonty_details_en` (text) - Détails pour Hellofonty en anglais
      - `agency_has` (boolean) - Si les agences proposent ce service
      - `agency_details_fr` (text) - Détails pour les agences en français (ex: "800€ - 1500€")
      - `agency_details_en` (text) - Détails pour les agences en anglais
      - `order_index` (integer) - Ordre d'affichage
      - `is_active` (boolean) - Si la ligne est active
      - `created_at` (timestamptz) - Date de création
  
  2. Sécurité
    - Enable RLS sur `agency_comparison_features`
    - Politique pour permettre la lecture publique
    - Politique pour permettre aux admins de gérer le contenu
*/

CREATE TABLE IF NOT EXISTS agency_comparison_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_fr text NOT NULL,
  feature_en text NOT NULL,
  hellofonty_has boolean DEFAULT true,
  hellofonty_details_fr text,
  hellofonty_details_en text,
  agency_has boolean DEFAULT false,
  agency_details_fr text,
  agency_details_en text,
  order_index integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agency_comparison_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tout le monde peut lire la comparaison avec les agences"
  ON agency_comparison_features
  FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Les admins peuvent insérer des critères de comparaison"
  ON agency_comparison_features
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Les admins peuvent modifier des critères de comparaison"
  ON agency_comparison_features
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

CREATE POLICY "Les admins peuvent supprimer des critères de comparaison"
  ON agency_comparison_features
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_agency_comparison_order ON agency_comparison_features(order_index);

-- Insertion des données initiales
INSERT INTO agency_comparison_features (feature_fr, feature_en, hellofonty_has, hellofonty_details_fr, hellofonty_details_en, agency_has, agency_details_fr, agency_details_en, order_index)
VALUES
  ('Frais pour le propriétaire', 'Landlord fees', true, '0€ - 99€/an', '0€ - 99€/year', false, '800€ - 1500€', '800€ - 1500€', 1),
  ('Frais pour l''étudiant', 'Student fees', true, '300€', '300€', false, '800€ - 1200€', '800€ - 1200€', 2),
  ('Gestion des annonces', 'Listing management', true, NULL, NULL, true, NULL, NULL, 3),
  ('Messagerie intégrée', 'Integrated messaging', true, NULL, NULL, false, NULL, NULL, 4),
  ('Génération de contrats', 'Contract generation', true, NULL, NULL, true, NULL, NULL, 5),
  ('État des lieux digital', 'Digital inventory', true, NULL, NULL, false, NULL, NULL, 6),
  ('Paiement en ligne sécurisé', 'Secure online payment', true, NULL, NULL, false, NULL, NULL, 7),
  ('Support client 7j/7', '24/7 customer support', true, NULL, NULL, false, NULL, NULL, 8),
  ('Calendrier synchronisé', 'Synchronized calendar', true, NULL, NULL, false, NULL, NULL, 9);