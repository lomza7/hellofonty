/*
  # Mise à jour du calcul des frais de service

  1. Modifications
    - Modifier le trigger pour utiliser les frais fixes depuis platform_settings
    - Les frais de service sont désormais un montant fixe, pas un pourcentage
*/

-- Recréer la fonction pour définir automatiquement les montants de paiement
CREATE OR REPLACE FUNCTION set_payment_deadline()
RETURNS TRIGGER AS $$
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
      SELECT price, security_deposit
      INTO v_listing_price, v_security_deposit
      FROM listings
      WHERE id = NEW.listing_id;
      
      -- Calculer le nombre de nuits
      v_nights := EXTRACT(DAY FROM (NEW.end_date - NEW.start_date));
      
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
$$ LANGUAGE plpgsql;

-- Le trigger existe déjà, pas besoin de le recréer