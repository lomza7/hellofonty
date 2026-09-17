/*
  # Recalcul correct des paiements de réservation

  1. Principe
    - Le premier paiement = premier mois uniquement (complet ou prorata)
    - Les mois suivants seront payés séparément via rent_payments
    - Correction des réservations existantes avec des montants incorrects

  2. Calcul du premier mois
    - Si commence le 1er du mois : loyer mensuel complet
    - Si commence après le 1er : prorata jusqu'à la fin du mois
*/

-- Recalculer les montants pour TOUTES les réservations confirmées
UPDATE bookings b
SET 
  rent_amount = CASE 
    -- Si commence après le 1er du mois : prorata du premier mois uniquement
    WHEN EXTRACT(DAY FROM b.start_date) > 1 THEN
      (l.price_per_month / EXTRACT(DAY FROM (DATE_TRUNC('month', b.start_date) + INTERVAL '1 month' - INTERVAL '1 day'))) * 
      (EXTRACT(DAY FROM (DATE_TRUNC('month', b.start_date) + INTERVAL '1 month' - INTERVAL '1 day')) - EXTRACT(DAY FROM b.start_date) + 1)
    -- Si commence le 1er du mois : loyer mensuel complet
    ELSE
      l.price_per_month
  END,
  deposit_amount = COALESCE(l.security_deposit, 0),
  service_fee = COALESCE(
    (SELECT setting_value::numeric FROM platform_settings WHERE setting_key = 'booking_service_fee' LIMIT 1),
    50.00
  ),
  is_first_month_partial = (EXTRACT(DAY FROM b.start_date) > 1),
  prorated_rent = CASE 
    WHEN EXTRACT(DAY FROM b.start_date) > 1 THEN
      (l.price_per_month / EXTRACT(DAY FROM (DATE_TRUNC('month', b.start_date) + INTERVAL '1 month' - INTERVAL '1 day'))) * 
      (EXTRACT(DAY FROM (DATE_TRUNC('month', b.start_date) + INTERVAL '1 month' - INTERVAL '1 day')) - EXTRACT(DAY FROM b.start_date) + 1)
    ELSE NULL
  END
FROM listings l
WHERE b.listing_id = l.id
  AND b.status = 'confirmed';

-- Recalculer payment_amount
UPDATE bookings
SET payment_amount = ROUND(rent_amount + deposit_amount + service_fee, 2)
WHERE status = 'confirmed';

/*
  # Ajout des frais de plateforme au paiement étudiant

  1. Modifications
    - Les frais de plateforme (récupérés depuis platform_settings) sont à la charge de l'étudiant
    - Premier paiement étudiant = loyer + caution + frais de plateforme
    - Le propriétaire reçoit uniquement : loyer + caution
    - La plateforme garde : frais de plateforme (390€ par défaut)

  2. Calculs
    - payment_amount = rent_amount + deposit_amount + platform_fee
    - Le montant des frais est récupéré dynamiquement depuis platform_settings
*/

-- Fonction pour récupérer les frais de plateforme
CREATE OR REPLACE FUNCTION get_platform_fee()
RETURNS numeric AS $$
DECLARE
  v_fee numeric;
BEGIN
  SELECT COALESCE(setting_value::numeric, 390)
  INTO v_fee
  FROM platform_settings
  WHERE setting_key = 'platform_fee_amount';
  
  RETURN COALESCE(v_fee, 390);
END;
$$ LANGUAGE plpgsql;

-- Ajouter une colonne pour les frais de plateforme
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'platform_fee'
  ) THEN
    ALTER TABLE bookings ADD COLUMN platform_fee numeric DEFAULT 0;
  END IF;
END $$;

-- Mettre à jour la fonction de calcul avec les frais de plateforme
CREATE OR REPLACE FUNCTION set_payment_deadline()
RETURNS TRIGGER AS $$
DECLARE
  v_listing_price numeric;
  v_security_deposit numeric;
  v_rent_amount numeric;
  v_platform_fee numeric;
  v_start_date date;
  v_end_of_first_month date;
  v_days_in_first_month integer;
  v_total_days_in_month integer;
BEGIN
  -- Si le statut passe à confirmed et qu'il n'y a pas encore de deadline
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') AND NEW.payment_deadline IS NULL THEN
    NEW.payment_deadline := NOW() + INTERVAL '7 days';
    NEW.payment_status := 'pending';
    
    -- Si les montants ne sont pas déjà calculés, les calculer
    IF NEW.payment_amount IS NULL THEN
      -- Récupérer les frais de plateforme
      v_platform_fee := get_platform_fee();
      
      -- Récupérer les infos du logement
      SELECT price_per_month, security_deposit
      INTO v_listing_price, v_security_deposit
      FROM listings
      WHERE id = NEW.listing_id;
      
      v_start_date := NEW.start_date;
      v_end_of_first_month := (DATE_TRUNC('month', v_start_date) + INTERVAL '1 month' - INTERVAL '1 day')::date;
      
      -- Vérifier si le premier mois est partiel
      IF EXTRACT(DAY FROM v_start_date) > 1 THEN
        -- Premier mois partiel : calculer le prorata
        v_days_in_first_month := EXTRACT(DAY FROM (DATE_TRUNC('month', v_start_date) + INTERVAL '1 month' - INTERVAL '1 day')) - EXTRACT(DAY FROM v_start_date) + 1;
        v_total_days_in_month := EXTRACT(DAY FROM (DATE_TRUNC('month', v_start_date) + INTERVAL '1 month' - INTERVAL '1 day'));
        v_rent_amount := (v_listing_price / v_total_days_in_month) * v_days_in_first_month;
        
        NEW.is_first_month_partial := true;
        NEW.prorated_rent := v_rent_amount;
      ELSE
        -- Premier mois complet
        v_rent_amount := v_listing_price;
        NEW.is_first_month_partial := false;
      END IF;
      
      -- Définir les montants
      NEW.rent_amount := v_rent_amount;
      NEW.deposit_amount := COALESCE(v_security_deposit, 0);
      NEW.platform_fee := v_platform_fee;
      NEW.service_fee := 0; -- Obsolète, on garde pour compatibilité
      NEW.payment_amount := v_rent_amount + COALESCE(v_security_deposit, 0) + v_platform_fee;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recalculer toutes les réservations existantes avec les frais de plateforme
UPDATE bookings b
SET 
  platform_fee = get_platform_fee(),
  service_fee = 0,
  payment_amount = ROUND(rent_amount + deposit_amount + get_platform_fee(), 2)
WHERE status = 'confirmed' AND payment_status = 'pending';

/*
  # Create FAQ System

  1. New Tables
    - `faqs`
      - `id` (uuid, primary key)
      - `question_fr` (text) - Question en français
      - `question_en` (text) - Question en anglais
      - `answer_fr` (text) - Réponse en français
      - `answer_en` (text) - Réponse en anglais
      - `display_order` (integer) - Ordre d'affichage
      - `is_active` (boolean) - Actif/Inactif
      - `category` (text) - Catégorie (students, landlords, general)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `faqs` table
    - Add policy for anyone to read active FAQs
    - Add policy for admins to manage FAQs
*/

CREATE TABLE IF NOT EXISTS faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_fr text NOT NULL,
  question_en text NOT NULL,
  answer_fr text NOT NULL,
  answer_en text NOT NULL,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  category text DEFAULT 'general',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active FAQs"
  ON faqs
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can insert FAQs"
  ON faqs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update FAQs"
  ON faqs
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

CREATE POLICY "Admins can delete FAQs"
  ON faqs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insérer quelques FAQs par défaut
INSERT INTO faqs (question_fr, question_en, answer_fr, answer_en, display_order, category) VALUES
  (
    'Comment fonctionne HELLOFONTY ?',
    'How does HELLOFONTY work?',
    'HELLOFONTY est une plateforme qui connecte les étudiants d''INSEAD avec des propriétaires locaux à Fontainebleau. Les étudiants peuvent rechercher des logements vérifiés, envoyer des demandes de réservation, et signer des baux électroniques en toute sécurité.',
    'HELLOFONTY is a platform that connects INSEAD students with local landlords in Fontainebleau. Students can search for verified accommodations, send booking requests, and sign electronic leases securely.',
    1,
    'general'
  ),
  (
    'Comment puis-je réserver un logement ?',
    'How can I book accommodation?',
    'Créez un compte, recherchez des logements disponibles, consultez les détails et envoyez une demande de réservation au propriétaire. Une fois approuvée, vous pourrez procéder au paiement sécurisé.',
    'Create an account, search for available accommodations, review details and send a booking request to the landlord. Once approved, you can proceed with secure payment.',
    2,
    'students'
  ),
  (
    'Quels sont les frais de service ?',
    'What are the service fees?',
    'Les frais de service sont calculés lors du processus de réservation et incluent la sécurité de la plateforme, le système de paiement sécurisé, et la gestion des baux électroniques.',
    'Service fees are calculated during the booking process and include platform security, secure payment system, and electronic lease management.',
    3,
    'general'
  ),
  (
    'Comment synchroniser mon calendrier Airbnb/Booking.com ?',
    'How to sync my Airbnb/Booking.com calendar?',
    'Dans vos annonces, accédez à la section "Gestion du calendrier" et ajoutez les liens iCal de vos autres plateformes. Les réservations se synchroniseront automatiquement pour éviter les doubles réservations.',
    'In your listings, access the "Calendar Management" section and add iCal links from your other platforms. Reservations will automatically sync to avoid double bookings.',
    4,
    'landlords'
  ),
  (
    'Comment puis-je mettre mon logement en ligne ?',
    'How can I list my property?',
    'Créez un compte propriétaire, cliquez sur "Ajouter une annonce" et remplissez tous les détails de votre logement. Une fois publié, votre annonce sera visible par les étudiants.',
    'Create a landlord account, click "Add Listing" and fill in all your property details. Once published, your listing will be visible to students.',
    5,
    'landlords'
  ),
  (
    'Les paiements sont-ils sécurisés ?',
    'Are payments secure?',
    'Oui, tous les paiements sont traités via Stripe, un leader mondial du paiement en ligne. Vos informations bancaires sont cryptées et sécurisées.',
    'Yes, all payments are processed through Stripe, a global leader in online payments. Your banking information is encrypted and secure.',
    6,
    'general'
  );
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
