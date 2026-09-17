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

/*
  # Changement de la deadline de paiement de 24 heures a 120 heures

  1. Modifications
    - La deadline de paiement passe de 24 heures a 120 heures (5 jours) apres confirmation
    - Cela laisse plus de temps a l'etudiant pour finaliser son paiement

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
    NEW.payment_deadline := NOW() + INTERVAL '120 hours';
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

/*
  # Changement de la deadline de paiement de 120 heures a 72 heures

  1. Modifications
    - La deadline de paiement passe de 120 heures a 72 heures (3 jours) apres confirmation
    - Compromis entre laisser du temps a l'etudiant et inciter a finaliser rapidement

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
    NEW.payment_deadline := NOW() + INTERVAL '72 hours';
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

/*
  # Fix listing favorites count trigger on DELETE

  1. Problem
    - The `update_listing_favorites_count()` trigger fires on both INSERT and DELETE of favorites
    - On DELETE, `NEW` is NULL, causing a NOT NULL constraint violation when it tries to INSERT into listing_statistics
    - This blocks CASCADE deletes from listings -> favorites, preventing listing deletion

  2. Fix
    - Use `COALESCE(NEW.listing_id, OLD.listing_id)` to handle both INSERT and DELETE events
    - Add a guard clause: if the listing no longer exists (CASCADE delete in progress), skip the update
    - Return NEW for INSERT, OLD for DELETE
*/

CREATE OR REPLACE FUNCTION update_listing_favorites_count()
RETURNS TRIGGER AS $$
DECLARE
  v_listing_id uuid;
BEGIN
  v_listing_id := COALESCE(NEW.listing_id, OLD.listing_id);

  IF v_listing_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM listings WHERE id = v_listing_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO listing_statistics (listing_id, total_favorites)
  VALUES (v_listing_id, 0)
  ON CONFLICT (listing_id) DO NOTHING;

  UPDATE listing_statistics
  SET 
    total_favorites = (
      SELECT COUNT(*) 
      FROM favorites 
      WHERE listing_id = v_listing_id
    ),
    updated_at = now()
  WHERE listing_id = v_listing_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
/*
  # Fix listing_images RLS: add UPDATE policy and admin access

  1. Problem
    - No UPDATE policy exists on listing_images, so reordering photos (changing display_order) is silently blocked by RLS
    - No admin policies exist, so admin users cannot manage listing images

  2. Changes
    - Add UPDATE policy for landlords to update their own listing images
    - Add SELECT, INSERT, UPDATE, DELETE policies for admin users
    - Landlords who own the listing can also read their own inactive listing images
*/

-- Landlords can update their own listing images (for reordering)
CREATE POLICY "Proprietaires peuvent modifier les images de leurs annonces"
  ON listing_images
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_images.listing_id
      AND listings.landlord_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_images.listing_id
      AND listings.landlord_id = auth.uid()
    )
  );

-- Landlords can view images of their own listings (even inactive)
CREATE POLICY "Proprietaires peuvent voir les images de leurs annonces"
  ON listing_images
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_images.listing_id
      AND listings.landlord_id = auth.uid()
    )
  );

-- Admin: SELECT
CREATE POLICY "Admins peuvent voir toutes les images"
  ON listing_images
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin: INSERT
CREATE POLICY "Admins peuvent ajouter des images"
  ON listing_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin: UPDATE
CREATE POLICY "Admins peuvent modifier toutes les images"
  ON listing_images
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin: DELETE
CREATE POLICY "Admins peuvent supprimer toutes les images"
  ON listing_images
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
