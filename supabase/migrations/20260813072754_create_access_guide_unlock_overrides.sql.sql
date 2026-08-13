/*
  # Dates de déverrouillage par réservation

  ## Contexte
  Actuellement, les dates unlock_date et valid_until_date sont stockées au niveau du
  guide d'accès (access_guides), qui est unique par logement. Quand un logement a
  plusieurs réservations la même année, toutes partagent les mêmes dates.

  ## Changements

  ### 1. Nouvelle table `access_guide_unlock_overrides`
  - `id` (uuid, primary key)
  - `booking_id` (uuid, référence vers bookings, UNIQUE) — une ligne max par réservation
  - `unlock_date` (date, nullable) — date de déverrouillage spécifique à cette réservation
  - `valid_until_date` (date, nullable) — date d'expiration spécifique à cette réservation
  - `created_at` / `updated_at` (timestamptz)

  ### 2. Mise à jour de la fonction `get_my_access_guide`
  - Priorité des dates : override de la réservation > dates du guide (logement) > défaut (24h avant start_date)
  - Les colonnes unlock_date et valid_until_date retournées reflètent la source effective

  ### 3. Sécurité
  - RLS activée sur access_guide_unlock_overrides
  - Le propriétaire du logement peut lire/écrire les overrides pour les réservations de ses logements
  - L'étudiant n'y accède pas directement (la fonction SECURITY DEFINER filtre déjà par student_id)
*/

CREATE TABLE IF NOT EXISTS access_guide_unlock_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  unlock_date date,
  valid_until_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE access_guide_unlock_overrides ENABLE ROW LEVEL SECURITY;

-- Le propriétaire peut voir les overrides pour les réservations de ses logements
DROP POLICY IF EXISTS "Landlords can view unlock overrides" ON access_guide_unlock_overrides;
CREATE POLICY "Landlords can view unlock overrides"
  ON access_guide_unlock_overrides FOR SELECT
  TO authenticated
  USING (
    booking_id IN (
      SELECT b.id FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE l.landlord_id = auth.uid()
    )
  );

-- Le propriétaire peut créer des overrides pour les réservations de ses logements
DROP POLICY IF EXISTS "Landlords can insert unlock overrides" ON access_guide_unlock_overrides;
CREATE POLICY "Landlords can insert unlock overrides"
  ON access_guide_unlock_overrides FOR INSERT
  TO authenticated
  WITH CHECK (
    booking_id IN (
      SELECT b.id FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE l.landlord_id = auth.uid()
    )
  );

-- Le propriétaire peut modifier les overrides pour les réservations de ses logements
DROP POLICY IF EXISTS "Landlords can update unlock overrides" ON access_guide_unlock_overrides;
CREATE POLICY "Landlords can update unlock overrides"
  ON access_guide_unlock_overrides FOR UPDATE
  TO authenticated
  USING (
    booking_id IN (
      SELECT b.id FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE l.landlord_id = auth.uid()
    )
  )
  WITH CHECK (
    booking_id IN (
      SELECT b.id FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE l.landlord_id = auth.uid()
    )
  );

-- Le propriétaire peut supprimer les overrides pour les réservations de ses logements
DROP POLICY IF EXISTS "Landlords can delete unlock overrides" ON access_guide_unlock_overrides;
CREATE POLICY "Landlords can delete unlock overrides"
  ON access_guide_unlock_overrides FOR DELETE
  TO authenticated
  USING (
    booking_id IN (
      SELECT b.id FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE l.landlord_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_unlock_overrides_booking_id ON access_guide_unlock_overrides(booking_id);

-- Mise à jour de la fonction pour prendre en compte les overrides par réservation
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
        ag.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        COALESCE(o.valid_until_date, ag.valid_until_date) IS NULL
        OR now() < COALESCE(o.valid_until_date, ag.valid_until_date)::timestamptz + interval '24 hours'
      )
    ) AS unlocked,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        ag.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        COALESCE(o.valid_until_date, ag.valid_until_date) IS NULL
        OR now() < COALESCE(o.valid_until_date, ag.valid_until_date)::timestamptz + interval '24 hours'
      )
    THEN ag.access_type END,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        ag.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        COALESCE(o.valid_until_date, ag.valid_until_date) IS NULL
        OR now() < COALESCE(o.valid_until_date, ag.valid_until_date)::timestamptz + interval '24 hours'
      )
    THEN ag.access_instructions END,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        ag.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        COALESCE(o.valid_until_date, ag.valid_until_date) IS NULL
        OR now() < COALESCE(o.valid_until_date, ag.valid_until_date)::timestamptz + interval '24 hours'
      )
    THEN ag.wifi_ssid END,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        ag.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        COALESCE(o.valid_until_date, ag.valid_until_date) IS NULL
        OR now() < COALESCE(o.valid_until_date, ag.valid_until_date)::timestamptz + interval '24 hours'
      )
    THEN ag.wifi_password END,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        ag.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        COALESCE(o.valid_until_date, ag.valid_until_date) IS NULL
        OR now() < COALESCE(o.valid_until_date, ag.valid_until_date)::timestamptz + interval '24 hours'
      )
    THEN ag.parking_info END,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        ag.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        COALESCE(o.valid_until_date, ag.valid_until_date) IS NULL
        OR now() < COALESCE(o.valid_until_date, ag.valid_until_date)::timestamptz + interval '24 hours'
      )
    THEN ag.access_photos END,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        ag.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        COALESCE(o.valid_until_date, ag.valid_until_date) IS NULL
        OR now() < COALESCE(o.valid_until_date, ag.valid_until_date)::timestamptz + interval '24 hours'
      )
    THEN ag.access_video END,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        ag.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        COALESCE(o.valid_until_date, ag.valid_until_date) IS NULL
        OR now() < COALESCE(o.valid_until_date, ag.valid_until_date)::timestamptz + interval '24 hours'
      )
    THEN ag.additional_info END,
    COALESCE(o.unlock_date, ag.unlock_date),
    COALESCE(o.valid_until_date, ag.valid_until_date)
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