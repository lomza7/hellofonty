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
