/*
  # Correction du calcul des nuits dans le trigger de paiement
  
  1. Changements
    - Remplacement de EXTRACT(DAY FROM (NEW.end_date - NEW.start_date)) par une simple soustraction
    - En PostgreSQL, soustraire deux colonnes de type DATE retourne directement un INTEGER (nombre de jours)
    - EXTRACT ne peut pas être utilisé sur un INTEGER, seulement sur un INTERVAL
  
  2. Impact
    - Corrige l'erreur "function pg_catalog.extract(unknown, integer) does not exist"
    - Permet le calcul correct du nombre de nuits
*/

CREATE OR REPLACE FUNCTION public.set_payment_deadline()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_listing_price numeric;
  v_security_deposit numeric;
  v_nights integer;
  v_rent_amount numeric;
  v_service_fee numeric;
BEGIN
  -- Si le statut passe à confirmed et qu'il n'y a pas encore de deadline
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') AND NEW.payment_deadline IS NULL THEN
    NEW.payment_deadline := NOW() + INTERVAL '7 days';
    NEW.payment_status := 'pending';
    
    -- Si les montants ne sont pas déjà calculés, les calculer
    IF NEW.payment_amount IS NULL THEN
      -- Récupérer les infos du logement
      SELECT price_per_month, security_deposit
      INTO v_listing_price, v_security_deposit
      FROM listings
      WHERE id = NEW.listing_id;
      
      -- Calculer le nombre de nuits (CORRECTION: soustraction directe de dates)
      v_nights := NEW.end_date - NEW.start_date;
      
      -- Calculer le loyer
      v_rent_amount := v_listing_price * v_nights;
      
      -- Récupérer les frais de service fixes depuis les paramètres
      SELECT COALESCE(setting_value::numeric, 50) INTO v_service_fee
      FROM platform_settings
      WHERE setting_key = 'booking_service_fee';
      
      -- Définir les montants
      NEW.rent_amount := v_rent_amount;
      NEW.deposit_amount := COALESCE(v_security_deposit, 0);
      NEW.service_fee := v_service_fee;
      NEW.payment_amount := v_rent_amount + COALESCE(v_security_deposit, 0) + v_service_fee;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;