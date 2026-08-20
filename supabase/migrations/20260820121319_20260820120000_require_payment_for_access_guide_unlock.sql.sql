/*
# Le guide d'accès ne se déverrouille que si le premier loyer est payé

## Contexte
Actuellement, la fonction get_my_access_guide déverrouille le guide d'accès
24h avant l'arrivée (ou à la date personnalisée par le propriétaire), mais ne
vérifie pas que l'étudiant a effectivement payé son premier loyer. Un étudiant
dont la réservation est confirmée mais qui n'a pas payé peut quand même accéder
aux codes d'entrée, WiFi et autres informations sensibles.

## Changements
### 1. Modification de la fonction get_my_access_guide
- Ajout de la condition `b.payment_status = 'completed'` dans le calcul du
  booléen `unlocked` et dans tous les CASE WHEN qui renvoient les champs
  sensibles (access_type, access_instructions, wifi_ssid, wifi_password,
  parking_info, access_photos, access_video, additional_info).
- Si le paiement n'est pas `completed` (pending, expired, refunded), le guide
  reste verrouillé et aucun champ sensible n'est renvoyé.
- La ligne existe toujours (l'étudiant voit l'écran verrouillé), mais les
  informations restent masquées côté serveur.

## Sécurité
- Aucun changement de politique RLS. La fonction reste SECURITY DEFINER et
  vérifie déjà que l'étudiant est propriétaire de la réservation.
- Le contrôle est côté serveur, donc non contournable par le navigateur.
*/

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
  valid_until_date date,
  payment_status text
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
      b.payment_status = 'completed'
      AND now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    ) AS unlocked,
    CASE WHEN
      b.payment_status = 'completed'
      AND now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.access_type END,
    CASE WHEN
      b.payment_status = 'completed'
      AND now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.access_instructions END,
    CASE WHEN
      b.payment_status = 'completed'
      AND now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.wifi_ssid END,
    CASE WHEN
      b.payment_status = 'completed'
      AND now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.wifi_password END,
    CASE WHEN
      b.payment_status = 'completed'
      AND now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.parking_info END,
    CASE WHEN
      b.payment_status = 'completed'
      AND now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.access_photos END,
    CASE WHEN
      b.payment_status = 'completed'
      AND now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.access_video END,
    CASE WHEN
      b.payment_status = 'completed'
      AND now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.additional_info END,
    o.unlock_date,
    o.valid_until_date,
    b.payment_status
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
