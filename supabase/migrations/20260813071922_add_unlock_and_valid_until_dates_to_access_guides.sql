/*
# Ajout des dates de déverrouillage et d'expiration personnalisées pour les guides d'accès

## Contexte
Actuellement, le guide d'accès d'un logement se déverrouille automatiquement 24h avant
la date d'arrivée de l'étudiant (bookings.start_date). Cette logique est codée en dur
dans la fonction RPC get_my_access_guide. Quand un étudiant arrive en avance (ex: la
veille), le propriétaire ne peut pas lui donner accès au guide sans modifier le contrat.

## Changements

### 1. Nouvelles colonnes sur la table `access_guides`
- `unlock_date` (date, nullable) : date à laquelle le guide devient accessible à
  l'étudiant. Quand cette colonne est NULL, le comportement par défaut (24h avant
  start_date) s'applique. Quand elle est renseignée, elle remplace la règle par défaut.
- `valid_until_date` (date, nullable) : date après laquelle le guide n'est plus
  accessible. Quand cette colonne est NULL, le guide reste valide jusqu'à la fin du
  séjour (bookings.end_date), comme aujourd'hui.

### 2. Modification de la fonction `get_my_access_guide`
- La colonne `unlocked` utilise désormais `unlock_date` si elle est renseignée,
  sinon `start_date - 24h` (comportement par défaut inchangé).
- Les champs sensibles ne sont renvoyés que si `unlocked = true` ET si
  `valid_until_date` n'est pas dépassée (ou absente).
- Ajout de deux colonnes de retour : `unlock_date` et `valid_until_date` pour que
  le frontend puisse afficher les bonnes dates à l'étudiant.

## Sécurité
- Aucun changement de politique RLS. La fonction reste SECURITY DEFINER et vérifie
  déjà que l'étudiant est propriétaire de la réservation (b.student_id = auth.uid()).
- Les colonnes sont facultatives (nullable) pour ne pas casser les guides existants.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'access_guides' AND column_name = 'unlock_date'
  ) THEN
    ALTER TABLE access_guides ADD COLUMN unlock_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'access_guides' AND column_name = 'valid_until_date'
  ) THEN
    ALTER TABLE access_guides ADD COLUMN valid_until_date date;
  END IF;
END $$;

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
      ag.unlock_date::timestamptz,
      b.start_date::timestamptz - interval '24 hours'
    )
    AND (
      ag.valid_until_date IS NULL
      OR now() < ag.valid_until_date::timestamptz + interval '24 hours'
    )
  ) AS unlocked,
  CASE WHEN
    now() >= COALESCE(
      ag.unlock_date::timestamptz,
      b.start_date::timestamptz - interval '24 hours'
    )
    AND (
      ag.valid_until_date IS NULL
      OR now() < ag.valid_until_date::timestamptz + interval '24 hours'
    )
  THEN ag.access_type END,
  CASE WHEN
    now() >= COALESCE(
      ag.unlock_date::timestamptz,
      b.start_date::timestamptz - interval '24 hours'
    )
    AND (
      ag.valid_until_date IS NULL
      OR now() < ag.valid_until_date::timestamptz + interval '24 hours'
    )
  THEN ag.access_instructions END,
  CASE WHEN
    now() >= COALESCE(
      ag.unlock_date::timestamptz,
      b.start_date::timestamptz - interval '24 hours'
    )
    AND (
      ag.valid_until_date IS NULL
      OR now() < ag.valid_until_date::timestamptz + interval '24 hours'
    )
  THEN ag.wifi_ssid END,
  CASE WHEN
    now() >= COALESCE(
      ag.unlock_date::timestamptz,
      b.start_date::timestamptz - interval '24 hours'
    )
    AND (
      ag.valid_until_date IS NULL
      OR now() < ag.valid_until_date::timestamptz + interval '24 hours'
    )
  THEN ag.wifi_password END,
  CASE WHEN
    now() >= COALESCE(
      ag.unlock_date::timestamptz,
      b.start_date::timestamptz - interval '24 hours'
    )
    AND (
      ag.valid_until_date IS NULL
      OR now() < ag.valid_until_date::timestamptz + interval '24 hours'
    )
  THEN ag.parking_info END,
  CASE WHEN
    now() >= COALESCE(
      ag.unlock_date::timestamptz,
      b.start_date::timestamptz - interval '24 hours'
    )
    AND (
      ag.valid_until_date IS NULL
      OR now() < ag.valid_until_date::timestamptz + interval '24 hours'
    )
  THEN ag.access_photos END,
  CASE WHEN
    now() >= COALESCE(
      ag.unlock_date::timestamptz,
      b.start_date::timestamptz - interval '24 hours'
    )
    AND (
      ag.valid_until_date IS NULL
      OR now() < ag.valid_until_date::timestamptz + interval '24 hours'
    )
  THEN ag.access_video END,
  CASE WHEN
    now() >= COALESCE(
      ag.unlock_date::timestamptz,
      b.start_date::timestamptz - interval '24 hours'
    )
    AND (
      ag.valid_until_date IS NULL
      OR now() < ag.valid_until_date::timestamptz + interval '24 hours'
    )
  THEN ag.additional_info END,
  ag.unlock_date,
  ag.valid_until_date
FROM bookings b
JOIN listings l ON l.id = b.listing_id
LEFT JOIN access_guides ag ON ag.listing_id = b.listing_id
WHERE b.id = p_booking_id
  AND b.student_id = auth.uid()
  AND b.status = 'confirmed'
  AND b.end_date >= CURRENT_DATE
LIMIT 1;
$function$;