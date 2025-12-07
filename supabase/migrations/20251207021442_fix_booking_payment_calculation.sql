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
