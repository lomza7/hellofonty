/*
  # Inclure la caution dans le premier paiement etudiant

  1. Probleme
    - Le trigger `calculate_prorated_payment` forcait `deposit_amount = 0` et
      excluait la caution du `payment_amount` du premier paiement.
    - L'etudiant ne se voyait donc jamais demander la caution lors du paiement.
    - Le trigger `set_payment_deadline` (qui inclut la caution) ne se declenche
      plus car il verifie `payment_amount IS NULL`, or calculate_prorated_payment
      s'execute avant et le remplit.

  2. Correction
    - calculate_prorated_payment recupere desormais `security_deposit` depuis
      la table listings et l'ajoute au `payment_amount`.
    - `deposit_amount` est desormais defini avec la valeur du listing (ou 0).

  3. Backfill
    - Recalcule `deposit_amount` et `payment_amount` pour les reservations
      confirmees non payees afin qu'elles integrent la caution.
*/

CREATE OR REPLACE FUNCTION calculate_prorated_payment()
RETURNS TRIGGER AS $$
DECLARE
  days_in_first_month integer;
  days_remaining integer;
  monthly_rent numeric;
  listing_security_deposit numeric;
  prorated_amount numeric;
  platform_fee numeric;
  total_duration_months integer;
BEGIN
  SELECT price_per_month, COALESCE(security_deposit, 0)
  INTO monthly_rent, listing_security_deposit
  FROM listings
  WHERE id = NEW.listing_id;

  days_in_first_month := EXTRACT(DAY FROM (DATE_TRUNC('month', NEW.start_date) + INTERVAL '1 month' - INTERVAL '1 day'));

  days_remaining := days_in_first_month - EXTRACT(DAY FROM NEW.start_date) + 1;

  total_duration_months := EXTRACT(YEAR FROM AGE(NEW.end_date, NEW.start_date)) * 12 +
    EXTRACT(MONTH FROM AGE(NEW.end_date, NEW.start_date));

  IF total_duration_months < 1 THEN
    total_duration_months := 1;
  END IF;

  NEW.total_months := total_duration_months;

  IF EXTRACT(DAY FROM NEW.start_date) > 1 THEN
    NEW.is_first_month_partial := true;
    prorated_amount := ROUND((monthly_rent / days_in_first_month) * days_remaining, 2);
    NEW.prorated_rent := prorated_amount;
    NEW.rent_amount := prorated_amount;
  ELSE
    NEW.is_first_month_partial := false;
    NEW.prorated_rent := monthly_rent;
    NEW.rent_amount := monthly_rent;
  END IF;

  SELECT COALESCE(setting_value::numeric, 50.00) INTO platform_fee
  FROM platform_settings
  WHERE setting_key = 'platform_fee_amount'
  LIMIT 1;

  IF platform_fee IS NULL THEN
    platform_fee := 50.00;
  END IF;

  NEW.service_fee := platform_fee;
  NEW.deposit_amount := listing_security_deposit;
  NEW.payment_amount := ROUND(NEW.rent_amount + listing_security_deposit + platform_fee, 2);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill : corriger les reservations confirmees non payees
UPDATE bookings b
SET
  deposit_amount = COALESCE(l.security_deposit, 0),
  payment_amount = ROUND(b.rent_amount + COALESCE(l.security_deposit, 0) + COALESCE(b.service_fee, 0), 2)
FROM listings l
WHERE b.listing_id = l.id
  AND b.status = 'confirmed'
  AND b.payment_status = 'pending'
  AND COALESCE(b.deposit_amount, 0) = 0
  AND COALESCE(l.security_deposit, 0) > 0;
