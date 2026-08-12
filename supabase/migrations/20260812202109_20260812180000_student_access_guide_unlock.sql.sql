/*
  Guide d'accès côté étudiant, déverrouillé 24 h avant l'arrivée
  + correctif de sécurité du partage par lien

  1. get_my_access_guide(booking_id) : ne renvoie le guide QUE si la réservation
     appartient à l'étudiant connecté, est confirmée, et que l'arrivée est dans
     moins de 24 h (contrôle côté serveur, pas seulement à l'affichage)
  2. SÉCURITÉ : supprime la politique publique trop large sur access_guides
     (elle laissait lire TOUS les guides — codes et wifi — à quiconque interroge la table)
     et la remplace par une fonction qui ne renvoie qu'UN guide contre son token exact.
*/

-- 1. Guide de l'étudiant, verrouillé jusqu'à H-24
CREATE OR REPLACE FUNCTION get_my_access_guide(p_booking_id uuid)
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
  additional_info text
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
    CASE WHEN now() >= (b.start_date::timestamptz - interval '24 hours') THEN ag.additional_info END
  FROM bookings b
  JOIN listings l ON l.id = b.listing_id
  LEFT JOIN access_guides ag ON ag.listing_id = b.listing_id
  WHERE b.id = p_booking_id
    AND b.student_id = auth.uid()
    AND b.status = 'confirmed'
    AND b.end_date >= CURRENT_DATE
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_my_access_guide(uuid) TO authenticated;

-- 2. Correctif sécurité du partage par token (le lien manuel du proprio)
DROP POLICY IF EXISTS "Anyone can view access guide with valid token" ON access_guides;

CREATE OR REPLACE FUNCTION get_access_guide_by_token(p_token text)
RETURNS TABLE (
  listing_id uuid,
  access_type text,
  access_instructions text,
  wifi_ssid text,
  wifi_password text,
  parking_info text,
  access_photos text[],
  access_video text,
  additional_info text
) LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT ag.listing_id, ag.access_type, ag.access_instructions, ag.wifi_ssid,
         ag.wifi_password, ag.parking_info, ag.access_photos, ag.access_video, ag.additional_info
  FROM access_guides ag
  WHERE ag.share_token = p_token AND ag.share_token IS NOT NULL
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_access_guide_by_token(text) TO anon, authenticated;