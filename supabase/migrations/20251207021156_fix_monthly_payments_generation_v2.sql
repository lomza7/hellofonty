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
