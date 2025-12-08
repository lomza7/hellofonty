/*
  # Système de comparaison Hellofonty VS Concurrents

  1. Nouvelle table
    - `comparison_items`
      - `id` (uuid, clé primaire)
      - `feature_fr` (text) - Nom de la fonctionnalité en français
      - `feature_en` (text) - Nom de la fonctionnalité en anglais
      - `hellofonty` (boolean) - Si Hellofonty propose cette fonctionnalité
      - `competitor_a` (boolean) - Si le concurrent A propose cette fonctionnalité
      - `competitor_b` (boolean) - Si le concurrent B propose cette fonctionnalité
      - `competitor_c` (boolean) - Si le concurrent C propose cette fonctionnalité
      - `category` (text) - Catégorie de la fonctionnalité
      - `order_index` (integer) - Ordre d'affichage
      - `is_highlight` (boolean) - Si c'est une fonctionnalité mise en avant
      - `created_at` (timestamptz) - Date de création

  2. Sécurité
    - Enable RLS sur `comparison_items`
    - Politique pour permettre la lecture publique
    - Politique pour permettre aux admins de gérer le contenu
*/

CREATE TABLE IF NOT EXISTS comparison_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_fr text NOT NULL,
  feature_en text NOT NULL,
  hellofonty boolean DEFAULT true,
  competitor_a boolean DEFAULT false,
  competitor_b boolean DEFAULT false,
  competitor_c boolean DEFAULT false,
  category text NOT NULL,
  order_index integer DEFAULT 0,
  is_highlight boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE comparison_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tout le monde peut lire les comparaisons"
  ON comparison_items
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Les admins peuvent insérer des comparaisons"
  ON comparison_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Les admins peuvent modifier des comparaisons"
  ON comparison_items
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

CREATE POLICY "Les admins peuvent supprimer des comparaisons"
  ON comparison_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_comparison_items_category ON comparison_items(category);
CREATE INDEX IF NOT EXISTS idx_comparison_items_order ON comparison_items(order_index);