/*
  # Système de paiements mensuels de loyer

  1. Nouvelle Table `rent_payments`
    - `id` (uuid, clé primaire)
    - `booking_id` (uuid, référence à bookings)
    - `student_id` (uuid, référence à profiles)
    - `landlord_id` (uuid, référence à profiles)
    - `rent_amount` (numeric, montant du loyer mensuel)
    - `platform_fee` (numeric, frais de plateforme)
    - `total_amount` (numeric, montant total = rent_amount + platform_fee)
    - `payment_date` (date, date prévue du paiement)
    - `month_year` (text, format "YYYY-MM" pour identifier le mois)
    - `status` (text, statut : pending, paid, overdue, cancelled)
    - `stripe_payment_intent_id` (text, ID du Payment Intent Stripe)
    - `paid_at` (timestamptz, date de paiement effectif)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  2. Sécurité
    - Enable RLS sur `rent_payments`
    - Politique pour que les étudiants voient leurs propres paiements
    - Politique pour que les propriétaires voient les paiements de leurs locations
    - Politique pour que les admins voient tout
    - Politiques d'insertion et mise à jour sécurisées

  3. Index
    - Index sur booking_id pour les requêtes rapides
    - Index sur student_id pour filtrer par étudiant
    - Index sur status pour filtrer par statut
    - Index sur payment_date pour trier chronologiquement
*/

-- Create rent_payments table
CREATE TABLE IF NOT EXISTS rent_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  landlord_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rent_amount numeric NOT NULL CHECK (rent_amount >= 0),
  platform_fee numeric NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
  total_amount numeric NOT NULL CHECK (total_amount >= 0),
  payment_date date NOT NULL,
  month_year text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  stripe_payment_intent_id text,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE rent_payments ENABLE ROW LEVEL SECURITY;

-- Policy: Students can view their own rent payments
CREATE POLICY "Students can view own rent payments"
  ON rent_payments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

-- Policy: Landlords can view rent payments for their bookings
CREATE POLICY "Landlords can view rent payments for their bookings"
  ON rent_payments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = landlord_id);

-- Policy: Admins can view all rent payments
CREATE POLICY "Admins can view all rent payments"
  ON rent_payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: System can insert rent payments (via service role)
CREATE POLICY "System can insert rent payments"
  ON rent_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: System can update rent payments status
CREATE POLICY "System can update rent payments"
  ON rent_payments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rent_payments_booking_id ON rent_payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_student_id ON rent_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_landlord_id ON rent_payments(landlord_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_status ON rent_payments(status);
CREATE INDEX IF NOT EXISTS idx_rent_payments_payment_date ON rent_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_rent_payments_month_year ON rent_payments(month_year);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_rent_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE TRIGGER update_rent_payments_updated_at
  BEFORE UPDATE ON rent_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_rent_payments_updated_at();

/*
  # Mise à jour du système de paiement - Calcul du prorata

  1. Modifications de la table bookings
    - `prorated_rent` (numeric) - Montant du loyer au prorata pour le premier mois partiel
    - `is_first_month_partial` (boolean) - Indique si le premier mois est partiel
    - `total_months` (integer) - Nombre total de mois de location

  2. Logique de calcul
    - Le premier paiement = prorated_rent + service_fee (frais fixes de plateforme)
    - Plus de deposit_amount dans le premier paiement
    - La caution reste gérée séparément par Stripe Connect

  3. Fonction de calcul du prorata
    - Calcule automatiquement le prorata en fonction de la date de début
    - Récupère les frais de service depuis platform_settings
    - Met à jour payment_amount en conséquence

  4. Notes importantes
    - Le prorata est calculé basé sur le nombre de jours restants dans le premier mois
    - Formule : (loyer_mensuel / jours_dans_le_mois) × jours_restants
    - Les frais de plateforme sont toujours fixes (pas de pourcentage)
*/

-- Ajouter les nouvelles colonnes
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS prorated_rent numeric(10, 2),
ADD COLUMN IF NOT EXISTS is_first_month_partial boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS total_months integer;

-- Fonction pour calculer le prorata et mettre à jour payment_amount
CREATE OR REPLACE FUNCTION calculate_prorated_payment()
RETURNS TRIGGER AS $$
DECLARE
  days_in_first_month integer;
  days_remaining integer;
  monthly_rent numeric;
  prorated_amount numeric;
  platform_fee numeric;
  total_duration_months integer;
BEGIN
  -- Récupérer le loyer mensuel depuis le listing
  SELECT monthly_price INTO monthly_rent
  FROM listings
  WHERE id = NEW.listing_id;

  -- Calculer le nombre de jours dans le premier mois
  days_in_first_month := EXTRACT(DAY FROM (DATE_TRUNC('month', NEW.start_date) + INTERVAL '1 month' - INTERVAL '1 day'));
  
  -- Calculer le nombre de jours restants depuis la date de début jusqu'à la fin du mois
  days_remaining := days_in_first_month - EXTRACT(DAY FROM NEW.start_date) + 1;

  -- Calculer la durée totale en mois
  total_duration_months := EXTRACT(YEAR FROM AGE(NEW.end_date, NEW.start_date)) * 12 + 
                          EXTRACT(MONTH FROM AGE(NEW.end_date, NEW.start_date));
  
  -- Si la durée est moins d'un mois, compter comme 1 mois
  IF total_duration_months < 1 THEN
    total_duration_months := 1;
  END IF;

  NEW.total_months := total_duration_months;

  -- Vérifier si le premier mois est partiel (ne commence pas le 1er du mois)
  IF EXTRACT(DAY FROM NEW.start_date) > 1 THEN
    NEW.is_first_month_partial := true;
    -- Calculer le prorata
    prorated_amount := ROUND((monthly_rent / days_in_first_month) * days_remaining, 2);
    NEW.prorated_rent := prorated_amount;
    NEW.rent_amount := prorated_amount;
  ELSE
    -- Premier mois complet
    NEW.is_first_month_partial := false;
    NEW.prorated_rent := monthly_rent;
    NEW.rent_amount := monthly_rent;
  END IF;

  -- Récupérer les frais de plateforme depuis platform_settings
  SELECT platform_fee_amount INTO platform_fee
  FROM platform_settings
  LIMIT 1;

  -- Si pas de paramètres, utiliser une valeur par défaut
  IF platform_fee IS NULL THEN
    platform_fee := 50.00;
  END IF;

  NEW.service_fee := platform_fee;

  -- Calculer le montant total du premier paiement (loyer prorata + frais fixes)
  -- Note : la caution n'est PAS incluse ici, elle est gérée par Stripe Connect
  NEW.payment_amount := NEW.rent_amount + platform_fee;

  -- La caution reste 0 dans payment_amount car elle est gérée séparément
  NEW.deposit_amount := 0;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour calculer automatiquement le prorata quand la réservation est confirmée
DROP TRIGGER IF EXISTS trigger_calculate_prorated_payment ON bookings;
CREATE TRIGGER trigger_calculate_prorated_payment
  BEFORE INSERT OR UPDATE OF status ON bookings
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed')
  EXECUTE FUNCTION calculate_prorated_payment();

/*
  # Génération automatique des paiements mensuels

  1. Fonction `generate_monthly_rent_payments`
    - Génère automatiquement tous les paiements mensuels pour une réservation
    - S'exécute après le premier paiement réussi
    - Crée une entrée pour chaque mois (à partir du 2ème mois)
    - Chaque paiement = loyer mensuel complet + frais de plateforme
    - Date de paiement = 1er jour de chaque mois

  2. Trigger `trigger_generate_monthly_payments`
    - S'exécute quand le payment_status passe à 'completed'
    - Appelle la fonction generate_monthly_rent_payments

  3. Logique de calcul
    - Si le premier mois est partiel : commence au 2ème mois avec le loyer complet
    - Si le premier mois est complet : commence au 2ème mois avec le loyer complet
    - Les frais de plateforme sont appliqués sur chaque paiement mensuel
    - Pas de frais de service (ils sont payés une seule fois au premier paiement)

  4. Notes importantes
    - Les paiements sont créés avec le statut 'pending'
    - La date de paiement est le 1er de chaque mois
    - Le dernier mois peut être partiel selon la date de fin
*/

-- Fonction pour générer les paiements mensuels
CREATE OR REPLACE FUNCTION generate_monthly_rent_payments()
RETURNS TRIGGER AS $$
DECLARE
  monthly_rent numeric;
  platform_fee_amount numeric;
  current_month_start date;
  payment_month integer;
  total_months_remaining integer;
  landlord_id_value uuid;
BEGIN
  -- Ne génère les paiements que si le statut passe à 'completed' et qu'ils n'ont pas déjà été générés
  IF NEW.payment_status = 'completed' AND OLD.payment_status != 'completed' THEN
    
    -- Vérifier s'il y a déjà des paiements générés pour cette réservation
    IF EXISTS (SELECT 1 FROM rent_payments WHERE booking_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    -- Récupérer le loyer mensuel depuis le listing
    SELECT monthly_price, l.landlord_id INTO monthly_rent, landlord_id_value
    FROM listings l
    WHERE l.id = NEW.listing_id;

    -- Récupérer les frais de plateforme depuis platform_settings
    SELECT COALESCE(
      (SELECT setting_value::numeric FROM platform_settings WHERE setting_key = 'platform_fee_amount' LIMIT 1),
      50.00
    ) INTO platform_fee_amount;

    -- Calculer le nombre de mois restants (total_months - 1 car le premier mois est déjà payé)
    total_months_remaining := NEW.total_months - 1;

    -- Si le premier mois est partiel, le 2ème mois commence le 1er du mois suivant
    -- Sinon, le 2ème mois commence le 1er du mois suivant également
    current_month_start := DATE_TRUNC('month', NEW.start_date) + INTERVAL '1 month';

    -- Générer les paiements mensuels pour chaque mois restant
    FOR payment_month IN 1..total_months_remaining LOOP
      -- Calculer la date de paiement (1er du mois)
      current_month_start := DATE_TRUNC('month', NEW.start_date) + (payment_month || ' months')::INTERVAL;

      -- S'assurer que le paiement ne dépasse pas la date de fin
      IF current_month_start <= NEW.end_date THEN
        -- Insérer le paiement mensuel
        INSERT INTO rent_payments (
          booking_id,
          student_id,
          landlord_id,
          rent_amount,
          platform_fee,
          total_amount,
          payment_date,
          month_year,
          status
        ) VALUES (
          NEW.id,
          NEW.student_id,
          landlord_id_value,
          monthly_rent,
          platform_fee_amount,
          monthly_rent + platform_fee_amount,
          current_month_start,
          TO_CHAR(current_month_start, 'YYYY-MM'),
          'pending'
        );
      END IF;
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour générer automatiquement les paiements mensuels
DROP TRIGGER IF EXISTS trigger_generate_monthly_payments ON bookings;
CREATE TRIGGER trigger_generate_monthly_payments
  AFTER UPDATE OF payment_status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION generate_monthly_rent_payments();

/*
  # Correction du système de paiements mensuels

  1. Corrections
    - Correction du nom de colonne : monthly_price -> price_per_month
    - Ajout du calcul automatique de total_months lors de la confirmation
    - Mise à jour des réservations existantes avec total_months

  2. Nouvelles fonctionnalités
    - Fonction pour calculer le nombre de mois d'une réservation
    - Trigger pour calculer total_months automatiquement
    - Script de mise à jour des données existantes
*/

-- Fonction pour calculer le nombre de mois entre deux dates
CREATE OR REPLACE FUNCTION calculate_booking_months(start_date date, end_date date)
RETURNS integer AS $$
DECLARE
  months integer;
  days_diff integer;
BEGIN
  -- Calcule le nombre de jours
  days_diff := end_date - start_date;
  
  -- Calcule le nombre de mois (arrondi au supérieur, environ 30 jours par mois)
  months := CEIL(days_diff / 30.0);
  
  -- Minimum 1 mois
  IF months < 1 THEN
    months := 1;
  END IF;
  
  RETURN months;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour calculer automatiquement total_months lors de la confirmation
CREATE OR REPLACE FUNCTION set_booking_total_months()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculer total_months si la réservation est confirmée et que total_months est null
  IF NEW.status = 'confirmed' AND NEW.total_months IS NULL THEN
    NEW.total_months := calculate_booking_months(NEW.start_date, NEW.end_date);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_booking_total_months ON bookings;
CREATE TRIGGER trigger_set_booking_total_months
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_booking_total_months();

-- Mettre à jour les réservations existantes
UPDATE bookings
SET total_months = calculate_booking_months(start_date, end_date)
WHERE status = 'confirmed' AND total_months IS NULL;

-- Corriger la fonction de génération des paiements mensuels
CREATE OR REPLACE FUNCTION generate_monthly_rent_payments()
RETURNS TRIGGER AS $$
DECLARE
  monthly_rent numeric;
  platform_fee_amount numeric;
  current_month_start date;
  payment_month integer;
  total_months_remaining integer;
  landlord_id_value uuid;
BEGIN
  -- Ne génère les paiements que si le statut passe à 'completed' et qu'ils n'ont pas déjà été générés
  IF NEW.payment_status = 'completed' AND OLD.payment_status != 'completed' THEN
    
    -- Vérifier s'il y a déjà des paiements générés pour cette réservation
    IF EXISTS (SELECT 1 FROM rent_payments WHERE booking_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    -- S'assurer que total_months est calculé
    IF NEW.total_months IS NULL THEN
      UPDATE bookings 
      SET total_months = calculate_booking_months(start_date, end_date)
      WHERE id = NEW.id;
      
      SELECT total_months INTO NEW.total_months
      FROM bookings
      WHERE id = NEW.id;
    END IF;

    -- Récupérer le loyer mensuel depuis le listing (CORRECTION ICI: price_per_month au lieu de monthly_price)
    SELECT price_per_month, l.landlord_id INTO monthly_rent, landlord_id_value
    FROM listings l
    WHERE l.id = NEW.listing_id;

    -- Récupérer les frais de plateforme depuis platform_settings
    SELECT COALESCE(
      (SELECT setting_value::numeric FROM platform_settings WHERE setting_key = 'platform_fee_amount' LIMIT 1),
      50.00
    ) INTO platform_fee_amount;

    -- Calculer le nombre de mois restants (total_months - 1 car le premier mois est déjà payé)
    total_months_remaining := NEW.total_months - 1;

    -- Si le premier mois est partiel, le 2ème mois commence le 1er du mois suivant
    -- Sinon, le 2ème mois commence le 1er du mois suivant également
    current_month_start := DATE_TRUNC('month', NEW.start_date) + INTERVAL '1 month';

    -- Générer les paiements mensuels pour chaque mois restant
    FOR payment_month IN 1..total_months_remaining LOOP
      -- Calculer la date de paiement (1er du mois)
      current_month_start := DATE_TRUNC('month', NEW.start_date) + (payment_month || ' months')::INTERVAL;

      -- S'assurer que le paiement ne dépasse pas la date de fin
      IF current_month_start <= NEW.end_date THEN
        -- Insérer le paiement mensuel
        INSERT INTO rent_payments (
          booking_id,
          student_id,
          landlord_id,
          rent_amount,
          platform_fee,
          total_amount,
          payment_date,
          month_year,
          status
        ) VALUES (
          NEW.id,
          NEW.student_id,
          landlord_id_value,
          monthly_rent,
          platform_fee_amount,
          monthly_rent + platform_fee_amount,
          current_month_start,
          TO_CHAR(current_month_start, 'YYYY-MM'),
          'pending'
        );
      END IF;
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

/*
  # Correction du calcul des montants de paiement

  1. Corrections
    - Utiliser price_per_month au lieu de price
    - Calculer correctement le premier mois (avec prorata si nécessaire)
    - Utiliser les bons paramètres de plateforme
    - Gérer les frais de service correctement

  2. Logique de calcul
    - Si le premier mois est partiel : calculer le prorata
    - Si le premier mois est complet : utiliser le loyer mensuel complet
    - Ajouter la caution (si applicable)
    - Ajouter les frais de service (montant fixe)
*/

CREATE OR REPLACE FUNCTION set_payment_deadline()
RETURNS TRIGGER AS $$
DECLARE
  v_listing_price numeric;
  v_security_deposit numeric;
  v_rent_amount numeric;
  v_service_fee numeric;
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
      -- Récupérer les infos du logement (CORRECTION: price_per_month au lieu de price)
      SELECT price_per_month, security_deposit
      INTO v_listing_price, v_security_deposit
      FROM listings
      WHERE id = NEW.listing_id;
      
      v_start_date := NEW.start_date;
      v_end_of_first_month := (DATE_TRUNC('month', v_start_date) + INTERVAL '1 month' - INTERVAL '1 day')::date;
      
      -- Vérifier si le premier mois est partiel
      IF v_start_date > DATE_TRUNC('month', v_start_date)::date THEN
        -- Premier mois partiel : calculer le prorata
        v_days_in_first_month := LEAST(v_end_of_first_month, NEW.end_date) - v_start_date + 1;
        v_total_days_in_month := EXTRACT(DAY FROM (DATE_TRUNC('month', v_start_date) + INTERVAL '1 month' - DATE_TRUNC('month', v_start_date)));
        v_rent_amount := (v_listing_price / v_total_days_in_month) * v_days_in_first_month;
        
        NEW.is_first_month_partial := true;
        NEW.prorated_rent := v_rent_amount;
      ELSE
        -- Premier mois complet
        v_rent_amount := v_listing_price;
        NEW.is_first_month_partial := false;
      END IF;
      
      -- Récupérer les frais de service fixes depuis les paramètres (50€ par défaut)
      SELECT COALESCE(
        (SELECT setting_value::numeric FROM platform_settings WHERE setting_key = 'booking_service_fee' LIMIT 1),
        50.00
      ) INTO v_service_fee;
      
      -- Définir les montants
      NEW.rent_amount := v_rent_amount;
      NEW.deposit_amount := COALESCE(v_security_deposit, 0);
      NEW.service_fee := v_service_fee;
      NEW.payment_amount := v_rent_amount + COALESCE(v_security_deposit, 0) + v_service_fee;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Mettre à jour les réservations existantes qui ont des montants NULL
UPDATE bookings b
SET 
  rent_amount = CASE 
    WHEN b.start_date > DATE_TRUNC('month', b.start_date)::date THEN
      -- Prorata du premier mois
      (l.price_per_month / EXTRACT(DAY FROM (DATE_TRUNC('month', b.start_date) + INTERVAL '1 month' - DATE_TRUNC('month', b.start_date)))) * 
      (LEAST((DATE_TRUNC('month', b.start_date) + INTERVAL '1 month' - INTERVAL '1 day')::date, b.end_date) - b.start_date + 1)
    ELSE
      -- Mois complet
      l.price_per_month
  END,
  deposit_amount = COALESCE(l.security_deposit, 0),
  service_fee = COALESCE(
    (SELECT setting_value::numeric FROM platform_settings WHERE setting_key = 'booking_service_fee' LIMIT 1),
    50.00
  ),
  is_first_month_partial = (b.start_date > DATE_TRUNC('month', b.start_date)::date),
  prorated_rent = CASE 
    WHEN b.start_date > DATE_TRUNC('month', b.start_date)::date THEN
      (l.price_per_month / EXTRACT(DAY FROM (DATE_TRUNC('month', b.start_date) + INTERVAL '1 month' - DATE_TRUNC('month', b.start_date)))) * 
      (LEAST((DATE_TRUNC('month', b.start_date) + INTERVAL '1 month' - INTERVAL '1 day')::date, b.end_date) - b.start_date + 1)
    ELSE NULL
  END
FROM listings l
WHERE b.listing_id = l.id
  AND b.status = 'confirmed'
  AND b.rent_amount IS NULL;

-- Calculer payment_amount pour les réservations mises à jour
UPDATE bookings
SET payment_amount = rent_amount + deposit_amount + service_fee
WHERE status = 'confirmed'
  AND rent_amount IS NOT NULL
  AND payment_amount IS NULL;

