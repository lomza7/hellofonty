/*
  # Paramètres des frais de plateforme

  1. Nouvelle table
    - `platform_settings` - Paramètres généraux de la plateforme
      - `id` (uuid, primary key)
      - `setting_key` (text, unique) - Clé du paramètre
      - `setting_value` (text) - Valeur du paramètre
      - `description` (text) - Description du paramètre
      - `updated_at` (timestamptz) - Date de dernière modification

  2. Sécurité
    - Seuls les admins peuvent modifier les paramètres
    - Tout le monde peut lire les paramètres publics
*/

-- Créer la table des paramètres
CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

-- Activer RLS
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Politique de lecture pour tous
CREATE POLICY "Anyone can read platform settings"
  ON platform_settings
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Politique d'écriture pour les admins uniquement
CREATE POLICY "Only admins can update platform settings"
  ON platform_settings
  FOR ALL
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

-- Insérer les frais de plateforme par défaut
INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES 
  ('booking_service_fee', '50', 'Frais de service fixes pour chaque réservation (en euros)'),
  ('platform_fee_percentage', '5', 'Pourcentage prélevé par la plateforme sur le total')
ON CONFLICT (setting_key) DO NOTHING;

-- Créer une fonction pour récupérer facilement un paramètre
CREATE OR REPLACE FUNCTION get_platform_setting(p_key text)
RETURNS text AS $$
DECLARE
  v_value text;
BEGIN
  SELECT setting_value INTO v_value
  FROM platform_settings
  WHERE setting_key = p_key;
  
  RETURN v_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour mettre à jour la colonne updated_at
CREATE OR REPLACE FUNCTION update_platform_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at
DROP TRIGGER IF EXISTS trigger_update_platform_settings_updated_at ON platform_settings;
CREATE TRIGGER trigger_update_platform_settings_updated_at
  BEFORE UPDATE ON platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_settings_updated_at();