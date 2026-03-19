/*
  # Changement de la deadline de paiement de 7 jours a 24 heures

  1. Modifications
    - La deadline de paiement passe de 7 jours a 24 heures apres confirmation
    - Cela pousse l'etudiant a payer rapidement apres acceptation

  2. Impact
    - Affecte uniquement les nouvelles reservations confirmees
    - Les reservations existantes gardent leur deadline actuelle
*/

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
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') AND NEW.payment_deadline IS NULL THEN
    NEW.payment_deadline := NOW() + INTERVAL '24 hours';
    NEW.payment_status := 'pending';
    
    IF NEW.payment_amount IS NULL THEN
      v_platform_fee := get_platform_fee();
      
      SELECT price_per_month, security_deposit
      INTO v_listing_price, v_security_deposit
      FROM listings
      WHERE id = NEW.listing_id;
      
      v_start_date := NEW.start_date;
      v_end_of_first_month := (DATE_TRUNC('month', v_start_date) + INTERVAL '1 month' - INTERVAL '1 day')::date;
      
      IF EXTRACT(DAY FROM v_start_date) > 1 THEN
        v_days_in_first_month := EXTRACT(DAY FROM (DATE_TRUNC('month', v_start_date) + INTERVAL '1 month' - INTERVAL '1 day')) - EXTRACT(DAY FROM v_start_date) + 1;
        v_total_days_in_month := EXTRACT(DAY FROM (DATE_TRUNC('month', v_start_date) + INTERVAL '1 month' - INTERVAL '1 day'));
        v_rent_amount := (v_listing_price / v_total_days_in_month) * v_days_in_first_month;
        
        NEW.is_first_month_partial := true;
        NEW.prorated_rent := v_rent_amount;
      ELSE
        v_rent_amount := v_listing_price;
        NEW.is_first_month_partial := false;
      END IF;
      
      NEW.rent_amount := v_rent_amount;
      NEW.deposit_amount := COALESCE(v_security_deposit, 0);
      NEW.platform_fee := v_platform_fee;
      NEW.service_fee := 0;
      NEW.payment_amount := v_rent_amount + COALESCE(v_security_deposit, 0) + v_platform_fee;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;