/*
  # Conversion des frais de plateforme en montant fixe

  1. Modifications
    - Supprimer le paramètre `platform_fee_percentage`
    - Ajouter le paramètre `platform_fee_amount` (montant fixe en euros)
    - Les frais de plateforme sont désormais un montant fixe, pas un pourcentage
*/

-- Supprimer l'ancien paramètre de pourcentage
DELETE FROM platform_settings WHERE setting_key = 'platform_fee_percentage';

-- Ajouter le nouveau paramètre de montant fixe
INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES 
  ('platform_fee_amount', '390', 'Frais fixes prélevés par la plateforme pour chaque réservation (en euros)')
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    description = EXCLUDED.description;