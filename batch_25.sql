/*
  # Suppression des dates génériques au niveau du logement

  ## Contexte
  Les dates unlock_date et valid_until_date étaient stockées au niveau du guide
  d'accès (access_guides), partagées par toutes les réservations. On passe maintenant
  à des dates par réservation uniquement.

  ## Changements
  ### 1. La fonction get_my_access_guide ne utilise plus ag.unlock_date / ag.valid_until_date
  ### 2. Les colonnes unlock_date et valid_until_date de access_guides sont supprimées
*/

-- Mise à jour de la fonction : priorité override > défaut (24h avant start_date)
DROP FUNCTION IF EXISTS public.get_my_access_guide(uuid);

CREATE FUNCTION public.get_my_access_guide(p_booking_id uuid)
RETURNS TABLE(
  listing_id uuid,
  listing_title text,
  listing_address text,
  listing_city text,
  start_date date,
  unlocked boolean,
  access_type text,
  access_instructions text,
  wifi_ssid text,
  wifi_password text,
  parking_info text,
  access_photos text[],
  access_video text,
  additional_info text,
  unlock_date date,
  valid_until_date date
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    l.id,
    l.title,
    l.address,
    l.city,
    b.start_date,
    (
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    ) AS unlocked,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.access_type END,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.access_instructions END,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.wifi_ssid END,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.wifi_password END,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.parking_info END,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.access_photos END,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.access_video END,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.additional_info END,
    o.unlock_date,
    o.valid_until_date
  FROM bookings b
  JOIN listings l ON l.id = b.listing_id
  LEFT JOIN access_guides ag ON ag.listing_id = b.listing_id
  LEFT JOIN access_guide_unlock_overrides o ON o.booking_id = b.id
  WHERE b.id = p_booking_id
    AND b.student_id = auth.uid()
    AND b.status = 'confirmed'
    AND b.end_date >= CURRENT_DATE
  LIMIT 1;
$function$;

-- Suppression des colonnes génériques au niveau du logement
ALTER TABLE access_guides DROP COLUMN IF EXISTS unlock_date;
ALTER TABLE access_guides DROP COLUMN IF EXISTS valid_until_date;
-- Add a CHECK constraint to access_guides.access_video to reject YouTube/video streaming URLs
-- Only allow Supabase storage URLs or empty/null values

ALTER TABLE access_guides
  DROP CONSTRAINT IF EXISTS access_video_must_be_storage_url;

ALTER TABLE access_guides
  ADD CONSTRAINT access_video_must_be_storage_url CHECK (
    access_video IS NULL
    OR access_video = ''
    OR (
      access_video NOT ILIKE '%youtube.com%'
      AND access_video NOT ILIKE '%youtu.be%'
      AND access_video NOT ILIKE '%vimeo.com%'
      AND access_video NOT ILIKE '%dailymotion.com%'
      AND access_video NOT ILIKE '%twitch.tv%'
      AND access_video NOT ILIKE '%facebook.com/%/videos%'
    )
  );
-- Remove the constraint that blocked YouTube/streaming URLs on access_guides.access_video
-- We now allow YouTube links in the access guide video section.

ALTER TABLE access_guides
  DROP CONSTRAINT IF EXISTS access_video_must_be_storage_url;
/*
  # Track first month payment in rent_payments

  1. Problem
    - When a student pays the first booking payment (rent + deposit + 299€ fee),
      the booking's payment_status becomes 'completed'.
    - The trigger generate_monthly_rent_payments creates rent_payments rows
      only for months 2 onwards (total_months - 1).
    - The first month payment is tracked only in bookings.payment_status,
      with NO corresponding entry in rent_payments.
    - The landlord dashboard (LandlordRentPayments.tsx) reads exclusively
      from rent_payments, so the first payment is invisible to landlords.

  2. Fix
    - Modify generate_monthly_rent_payments to also insert a first-month
      rent_payments row with status='paid' and paid_at set to now().
    - This row uses the booking's rent_amount (which may be prorated for
      partial first months) and platform_fee = 299 (the one-time fee).
    - total_amount = rent_amount + 299 (matching what the student paid
      for the rent portion + platform fee; deposit is separate).
    - Backfill all existing completed bookings that have rent_payments
      but are missing the first-month entry.

  3. Important Notes
    - The first-month entry is marked 'paid' immediately because the
      booking payment already succeeded (that's what triggered the
      payment_status = 'completed' transition).
    - No data is lost: existing rent_payments rows for months 2+ are
      preserved. Only a new row is inserted for month 1.
    - The is_first_month_partial flag on bookings determines whether
      the first month rent is prorated; we use booking.rent_amount
      which already reflects the correct prorated amount.
*/

CREATE OR REPLACE FUNCTION generate_monthly_rent_payments()
RETURNS TRIGGER AS $$
DECLARE
  monthly_rent numeric;
  first_month_rent numeric;
  platform_fee_amount numeric;
  current_month_start date;
  first_month_start date;
  payment_month integer;
  total_months_remaining integer;
  landlord_id_value uuid;
  first_month_year text;
BEGIN
  IF NEW.payment_status = 'completed' AND OLD.payment_status != 'completed' THEN

    IF EXISTS (SELECT 1 FROM rent_payments WHERE booking_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    IF NEW.total_months IS NULL THEN
      UPDATE bookings
      SET total_months = calculate_booking_months(start_date, end_date)
      WHERE id = NEW.id;

      SELECT total_months INTO NEW.total_months
      FROM bookings
      WHERE id = NEW.id;
    END IF;

    SELECT price_per_month, l.landlord_id INTO monthly_rent, landlord_id_value
    FROM listings l
    WHERE l.id = NEW.listing_id;

    -- Use the booking's rent_amount for the first month (may be prorated)
    first_month_rent := COALESCE(NEW.rent_amount, monthly_rent);

    -- Platform fee is charged once on the first payment
    SELECT COALESCE(
      (SELECT setting_value::numeric FROM platform_settings WHERE setting_key = 'platform_fee_amount' LIMIT 1),
      299.00
    ) INTO platform_fee_amount;

    -- Create first-month entry (marked as paid since booking payment succeeded)
    first_month_start := DATE_TRUNC('month', NEW.start_date);
    first_month_year := TO_CHAR(first_month_start, 'YYYY-MM');

    INSERT INTO rent_payments (
      booking_id,
      student_id,
      landlord_id,
      rent_amount,
      platform_fee,
      total_amount,
      payment_date,
      month_year,
      status,
      paid_at
    ) VALUES (
      NEW.id,
      NEW.student_id,
      landlord_id_value,
      first_month_rent,
      platform_fee_amount,
      first_month_rent + platform_fee_amount,
      first_month_start,
      first_month_year,
      'paid',
      NOW()
    );

    -- Generate remaining monthly payments (months 2+)
    total_months_remaining := NEW.total_months - 1;

    FOR payment_month IN 1..total_months_remaining LOOP
      current_month_start := DATE_TRUNC('month', NEW.start_date) + (payment_month || ' months')::INTERVAL;

      IF current_month_start <= NEW.end_date THEN
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
          0,
          monthly_rent,
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

-- Backfill: create first-month rent_payments entries for existing completed bookings
-- that already have monthly rent_payments but are missing the first-month entry
INSERT INTO rent_payments (
  booking_id,
  student_id,
  landlord_id,
  rent_amount,
  platform_fee,
  total_amount,
  payment_date,
  month_year,
  status,
  paid_at
)
SELECT
  b.id,
  b.student_id,
  l.landlord_id,
  COALESCE(b.rent_amount, l.price_per_month),
  COALESCE(b.platform_fee, 299.00),
  COALESCE(b.rent_amount, l.price_per_month) + COALESCE(b.platform_fee, 299.00),
  DATE_TRUNC('month', b.start_date)::date,
  TO_CHAR(DATE_TRUNC('month', b.start_date), 'YYYY-MM'),
  'paid',
  NOW()
FROM bookings b
JOIN listings l ON b.listing_id = l.id
WHERE b.payment_status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM rent_payments rp
    WHERE rp.booking_id = b.id
      AND rp.month_year = TO_CHAR(DATE_TRUNC('month', b.start_date), 'YYYY-MM')
  )
  AND EXISTS (
    SELECT 1 FROM rent_payments rp
    WHERE rp.booking_id = b.id
  );

/*
  # Fix rent_payments generation to use date range, not total_months

  The previous trigger relied on bookings.total_months to decide how many
  rent_payments rows to create. That field is often incorrect (e.g. a 6-month
  booking stored total_months=5), causing missing months in the landlord
  schedule. The student side computes the schedule by iterating from start
  to end date directly — the trigger must do the same.

  This rewrite:
  - Always computes the month list from start_date..end_date
  - Inserts the first month as 'paid' (booking payment already succeeded)
  - Inserts all subsequent months as 'pending'
  - Skips if rent_payments already exist for this booking (idempotent)
*/

CREATE OR REPLACE FUNCTION generate_monthly_rent_payments()
RETURNS TRIGGER AS $$
DECLARE
  monthly_rent numeric;
  first_month_rent numeric;
  platform_fee_amount numeric;
  current_month_start date;
  first_month_start date;
  landlord_id_value uuid;
BEGIN
  IF NEW.payment_status = 'completed' AND OLD.payment_status != 'completed' THEN

    IF EXISTS (SELECT 1 FROM rent_payments WHERE booking_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    SELECT price_per_month, l.landlord_id INTO monthly_rent, landlord_id_value
    FROM listings l
    WHERE l.id = NEW.listing_id;

    first_month_rent := COALESCE(NEW.rent_amount, monthly_rent);

    SELECT COALESCE(
      (SELECT setting_value::numeric FROM platform_settings WHERE setting_key = 'platform_fee_amount' LIMIT 1),
      299.00
    ) INTO platform_fee_amount;

    first_month_start := DATE_TRUNC('month', NEW.start_date)::date;

    -- First month: marked as paid
    INSERT INTO rent_payments (
      booking_id, student_id, landlord_id,
      rent_amount, platform_fee, total_amount,
      payment_date, month_year, status, paid_at
    ) VALUES (
      NEW.id, NEW.student_id, landlord_id_value,
      first_month_rent, platform_fee_amount, first_month_rent + platform_fee_amount,
      first_month_start, TO_CHAR(first_month_start, 'YYYY-MM'),
      'paid', NOW()
    );

    -- Remaining months: iterate from start+1 month until we pass end_date
    current_month_start := (DATE_TRUNC('month', NEW.start_date) + INTERVAL '1 month')::date;

    WHILE current_month_start <= NEW.end_date LOOP
      INSERT INTO rent_payments (
        booking_id, student_id, landlord_id,
        rent_amount, platform_fee, total_amount,
        payment_date, month_year, status
      ) VALUES (
        NEW.id, NEW.student_id, landlord_id_value,
        monthly_rent, 0, monthly_rent,
        current_month_start, TO_CHAR(current_month_start, 'YYYY-MM'),
        'pending'
      );

      current_month_start := (current_month_start + INTERVAL '1 month')::date;
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill: insert any missing months for existing completed bookings
-- where rent_payments exist but don't cover the full date range
DO $$
DECLARE
  b RECORD;
  monthly_rent_val numeric;
  landlord_id_val uuid;
  current_month date;
  first_month date;
  first_month_rent_val numeric;
  platform_fee_val numeric;
BEGIN
  SELECT COALESCE(
    (SELECT setting_value::numeric FROM platform_settings WHERE setting_key = 'platform_fee_amount' LIMIT 1),
    299.00
  ) INTO platform_fee_val;

  FOR b IN SELECT * FROM bookings WHERE payment_status = 'completed' LOOP
    SELECT price_per_month, landlord_id INTO monthly_rent_val, landlord_id_val
    FROM listings WHERE id = b.listing_id;

    IF NOT FOUND THEN CONTINUE; END IF;

    first_month := DATE_TRUNC('month', b.start_date)::date;
    first_month_rent_val := COALESCE(b.rent_amount, monthly_rent_val);

    -- Ensure first month exists (paid)
    IF NOT EXISTS (
      SELECT 1 FROM rent_payments
      WHERE booking_id = b.id AND month_year = TO_CHAR(first_month, 'YYYY-MM')
    ) THEN
      INSERT INTO rent_payments (
        booking_id, student_id, landlord_id,
        rent_amount, platform_fee, total_amount,
        payment_date, month_year, status, paid_at
      ) VALUES (
        b.id, b.student_id, landlord_id_val,
        first_month_rent_val, platform_fee_val, first_month_rent_val + platform_fee_val,
        first_month, TO_CHAR(first_month, 'YYYY-MM'),
        'paid', NOW()
      );
    END IF;

    -- Ensure all subsequent months exist (pending)
    current_month := (DATE_TRUNC('month', b.start_date) + INTERVAL '1 month')::date;

    WHILE current_month <= b.end_date LOOP
      IF NOT EXISTS (
        SELECT 1 FROM rent_payments
        WHERE booking_id = b.id AND month_year = TO_CHAR(current_month, 'YYYY-MM')
      ) THEN
        INSERT INTO rent_payments (
          booking_id, student_id, landlord_id,
          rent_amount, platform_fee, total_amount,
          payment_date, month_year, status
        ) VALUES (
          b.id, b.student_id, landlord_id_val,
          monthly_rent_val, 0, monthly_rent_val,
          current_month, TO_CHAR(current_month, 'YYYY-MM'),
          'pending'
        );
      END IF;

      current_month := (current_month + INTERVAL '1 month')::date;
    END LOOP;
  END LOOP;
END $$;

