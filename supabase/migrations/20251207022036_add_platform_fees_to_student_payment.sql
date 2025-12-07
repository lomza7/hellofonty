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
