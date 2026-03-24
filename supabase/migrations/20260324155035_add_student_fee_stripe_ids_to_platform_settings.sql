/*
  # Add Stripe IDs for student reservation fee to platform_settings

  1. New Settings
    - `student_fee_stripe_price_id` - The Stripe Price ID used for the student reservation fee
    - `student_fee_stripe_product_id` - The Stripe Product ID for the student reservation fee
    - `student_fee_features_fr` - Comma-separated list of features in French for the student plan display
    - `student_fee_features_en` - Comma-separated list of features in English for the student plan display

  2. Context
    - The student reservation fee amount is already stored in `platform_fee_amount`
    - These new settings allow admin to sync the price with a Stripe product/price
    - When admin syncs from Stripe, the `platform_fee_amount` is automatically updated to match Stripe
    - This ensures the displayed price, analytics, and actual Stripe charges all match

  3. Important Notes
    - The `platform_fee_amount` remains the single source of truth for the fee amount
    - Stripe sync updates `platform_fee_amount` automatically
    - Features are stored as JSON arrays for display on the Pricing page
*/

INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES
  ('student_fee_stripe_price_id', '', 'ID du prix Stripe pour les frais de réservation étudiant')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES
  ('student_fee_stripe_product_id', '', 'ID du produit Stripe pour les frais de réservation étudiant')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES
  ('student_fee_features_fr', '["Frais de mise en relation","Assurance réservation","Support 24/7","Paiement sécurisé"]', 'Liste des avantages du plan étudiant (FR, JSON array)')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES
  ('student_fee_features_en', '["Connection fee","Booking insurance","24/7 Support","Secure payment"]', 'Liste des avantages du plan étudiant (EN, JSON array)')
ON CONFLICT (setting_key) DO NOTHING;
