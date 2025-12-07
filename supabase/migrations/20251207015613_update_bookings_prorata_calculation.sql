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
