/*
  # Ajout des codes d'accès structurés au guide d'accès

  ## Contexte
  Les propriétaires peuvent désormais saisir plusieurs codes d'accès (boîte à clés,
  digicode, portail, interphone, etc.) directement dans le guide, au lieu de tout
  mélanger dans le champ libre "instructions d'accès".

  ## Changements

  ### 1. Nouvelle colonne sur `access_guides`
  - `access_codes` (jsonb, défaut '[]') : tableau JSON d'objets `{ type, code }`.
    Exemple : `[{"type":"digicode","code":"1234A"},{"type":"boite_a_cles","code":"5678"}]`.
    Types attendus côté interface : digicode, boite_a_cles, portail, interphone, autre.

  ### 2. Mise à jour des fonctions RPC
  - `get_my_access_guide(uuid)` : ajoute `access_codes jsonb` (verrouillé H-24).
  - `get_access_guide_by_token(text)` : ajoute `access_codes jsonb`.
  Les fonctions sont DROP puis CREATE car le type de retour change (nouvelle colonne).

  ### 3. Sécurité
  - Pas de nouvelle table ni nouvelle politique.
  - `access_codes` est couverte par les politiques RLS existantes d'`access_guides`.
  - Les fonctions restent SECURITY DEFINER avec le même verrouillage.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'access_guides'
      AND column_name = 'access_codes'
  ) THEN
    ALTER TABLE access_guides ADD COLUMN access_codes jsonb DEFAULT '[]'::jsonb;
  END IF;
END
$$;

DROP FUNCTION IF EXISTS get_my_access_guide(uuid);
DROP FUNCTION IF EXISTS get_access_guide_by_token(text);

CREATE FUNCTION get_my_access_guide(p_booking_id uuid)
RETURNS TABLE (
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
  access_codes jsonb
) LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    l.id,
    l.title,
    l.address,
    l.city,
    b.start_date,
    (now() >= (b.start_date::timestamptz - interval '24 hours')) AS unlocked,
    CASE WHEN now() >= (b.start_date::timestamptz - interval '24 hours') THEN ag.access_type END,
    CASE WHEN now() >= (b.start_date::timestamptz - interval '24 hours') THEN ag.access_instructions END,
    CASE WHEN now() >= (b.start_date::timestamptz - interval '24 hours') THEN ag.wifi_ssid END,
    CASE WHEN now() >= (b.start_date::timestamptz - interval '24 hours') THEN ag.wifi_password END,
    CASE WHEN now() >= (b.start_date::timestamptz - interval '24 hours') THEN ag.parking_info END,
    CASE WHEN now() >= (b.start_date::timestamptz - interval '24 hours') THEN ag.access_photos END,
    CASE WHEN now() >= (b.start_date::timestamptz - interval '24 hours') THEN ag.access_video END,
    CASE WHEN now() >= (b.start_date::timestamptz - interval '24 hours') THEN ag.additional_info END,
    CASE WHEN now() >= (b.start_date::timestamptz - interval '24 hours') THEN ag.access_codes END
  FROM bookings b
  JOIN listings l ON l.id = b.listing_id
  LEFT JOIN access_guides ag ON ag.listing_id = b.listing_id
  WHERE b.id = p_booking_id
    AND b.student_id = auth.uid()
    AND b.status = 'confirmed'
    AND b.end_date >= CURRENT_DATE
  LIMIT 1;
$$;

CREATE FUNCTION get_access_guide_by_token(p_token text)
RETURNS TABLE (
  listing_id uuid,
  access_type text,
  access_instructions text,
  wifi_ssid text,
  wifi_password text,
  parking_info text,
  access_photos text[],
  access_video text,
  additional_info text,
  access_codes jsonb
) LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT ag.listing_id, ag.access_type, ag.access_instructions, ag.wifi_ssid,
         ag.wifi_password, ag.parking_info, ag.access_photos, ag.access_video,
         ag.additional_info, ag.access_codes
  FROM access_guides ag
  WHERE ag.share_token = p_token AND ag.share_token IS NOT NULL
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_my_access_guide(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_access_guide_by_token(text) TO anon, authenticated;