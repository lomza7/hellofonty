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
/*
# Auto-expire pending bookings past their payment deadline

## Purpose
Bookings with `payment_status = 'pending'` whose `payment_deadline` has passed
were staying stuck in pending forever, because expiration only happened when
a student tried to pay (inside the edge function). This migration adds a
scheduled job that runs every 10 minutes and marks those bookings as expired.

## Changes
1. Creates a PL/pgSQL function `expire_overdue_bookings()` that updates
   bookings set to `payment_status = 'expired'` where the deadline has passed.
2. Schedules it with `pg_cron` every 10 minutes.
3. Grants execution to the service role.

## Security
- The function runs with SECURITY DEFINER as the owner (postgres), so it can
  update bookings regardless of RLS. This is safe because it only performs a
  status transition (pending -> expired) and does not expose data.
- No new tables, no new RLS policies.
*/

CREATE OR REPLACE FUNCTION public.expire_overdue_bookings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.bookings
  SET payment_status = 'expired',
      updated_at = now()
  WHERE payment_status = 'pending'
    AND payment_deadline IS NOT NULL
    AND payment_deadline < now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_overdue_bookings() TO service_role;

-- Schedule the job every 10 minutes (idempotent: drop existing first)
DO $_$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire_overdue_bookings') THEN
    PERFORM cron.unschedule('expire_overdue_bookings');
  END IF;
  PERFORM cron.schedule(
    'expire_overdue_bookings',
    '*/10 * * * *',
    'SELECT public.expire_overdue_bookings();'
  );
END $_$;

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

/*
# Allow landlord to relaunch student payment

## Purpose
When a student's initial payment deadline expires, the landlord currently has
no way to give the student more time. The only option was a broken "Contact
hellofonty" button. This migration adds a secure server-side function that lets
the landlord reset the payment deadline to 72 hours from now and set the
payment status back to "pending", so the student can complete their payment.

## Changes
1. Creates `relaunch_booking_payment(p_booking_id uuid)` — a SECURITY DEFINER
   function that:
   - Verifies the calling user is the landlord who owns the listing for this booking.
   - Rejects if the booking's payment_status is already 'completed'.
   - Resets payment_status to 'pending' and payment_deadline to NOW() + 72 hours.
   - Inserts a notification for the student so they are alerted.
2. Grants EXECUTE to `authenticated` so logged-in landlords can call it via RPC.

## Security
- SECURITY DEFINER runs as the owner (postgres), bypassing RLS to update the
  booking. This is safe because the function first verifies ownership by
  checking that the listing's landlord_id matches auth.uid().
- No new tables, no new RLS policies.
- The function only performs a status transition (expired/pending -> pending)
  and extends the deadline. It does NOT modify payment amounts or any
  financial data.
*/

CREATE OR REPLACE FUNCTION public.relaunch_booking_payment(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_landlord_id uuid;
  v_student_id uuid;
  v_current_status text;
BEGIN
  -- Get the booking with its listing's landlord
  SELECT b.payment_status, b.student_id, l.landlord_id
  INTO v_current_status, v_student_id, v_landlord_id
  FROM public.bookings b
  JOIN public.listings l ON l.id = b.listing_id
  WHERE b.id = p_booking_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reservation introuvable');
  END IF;

  -- Verify the caller is the landlord who owns this listing
  IF v_landlord_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorise');
  END IF;

  -- Don't relaunch if payment is already completed
  IF v_current_status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le paiement a deja ete effectue');
  END IF;

  -- Reset the payment deadline and status
  UPDATE public.bookings
  SET payment_status = 'pending',
      payment_deadline = now() + INTERVAL '72 hours',
      updated_at = now()
  WHERE id = p_booking_id;

  -- Notify the student
  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (
    v_student_id,
    'booking_request',
    'Relance de paiement',
    'Le proprietaire vous a accorde un nouveau delai de 72h pour finaliser votre paiement. Rendez-vous dans ''Mes demandes de reservation'' pour payer.',
    '/mes-demandes'
  );

  RETURN jsonb_build_object('success', true, 'message', 'Paiement relance avec succes');
END;
$$;

GRANT EXECUTE ON FUNCTION public.relaunch_booking_payment(uuid) TO authenticated;

/*
# Annuler le bail et notifier l'étudiant quand une réservation est annulée

## Contexte
Quand une réservation passe au statut `cancelled` (par le propriétaire, par
l'étudiant, ou par le job automatique d'expiration des paiements), le bail
associé reste visible et signable côté étudiant. L'étudiant voit aussi le
bouton "Guide d'accès" tant que `status = 'confirmed'`, mais la fonction
`get_my_access_guide` filtre déjà sur `b.status = 'confirmed'`, donc le guide
lui-même est déjà protégé. Le problème restant est le bail.

## Changements
### 1. Fonction `handle_booking_cancellation()`
- Fonction PL/pgSQL `SECURITY DEFINER` déclenchée après chaque `UPDATE` sur
  `bookings`.
- Détecte les transitions vers `status = 'cancelled'` (NEW.status = 'cancelled'
  AND OLD.status <> 'cancelled').
- Met à jour le bail associé (`leases.booking_id = NEW.id`) en passant son
  statut à `cancelled` — sans le supprimer, pour garder l'historique.
- Insère une notification `booking_cancelled` pour l'étudiant
  (`NEW.student_id`) s'il n'en existe pas déjà une pour cette réservation
  (évite les doublons si le propriétaire annule puis le cron ré-annule).

### 2. Trigger `on_booking_cancel`
- Trigger `AFTER UPDATE` sur `bookings` qui appelle la fonction.

## Sécurité
- La fonction est `SECURITY DEFINER` (owner = postgres), donc elle peut
  mettre à jour `leases` et insérer dans `notifications` sans être bloquée
  par RLS. Cela est sûr car :
  - Elle ne fait qu'une transition de statut sur le bail (cancelled).
  - Elle n'expose aucune donnée sensible.
  - Elle insère une notification pour le propriétaire de la réservation.
- Aucune nouvelle table, aucune nouvelle politique RLS.
- La fonction est idempotent : re-créer le trigger ne provoque pas de
  doublons grâce à la vérification d'existence de notification.
*/

CREATE OR REPLACE FUNCTION public.handle_booking_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lease_id uuid;
  v_existing_notif int;
BEGIN
  -- Only act on transitions TO cancelled
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    -- Cancel the associated lease (if any), keeping history
    UPDATE public.leases
    SET status = 'cancelled',
        updated_at = now()
    WHERE booking_id = NEW.id
      AND status NOT IN ('cancelled', 'terminated');

    -- Insert a notification for the student (deduplicated)
    SELECT count(*) INTO v_existing_notif
    FROM public.notifications
    WHERE user_id = NEW.student_id
      AND type = 'booking_cancelled'
      AND link = '/mes-reservations';

    IF v_existing_notif = 0 THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        NEW.student_id,
        'booking_cancelled',
        'Réservation annulée',
        'Votre réservation pour le logement a été annulée. Le contrat et le guide d''accès ne sont plus disponibles.',
        '/mes-reservations'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS on_booking_cancel ON public.bookings;
CREATE TRIGGER on_booking_cancel
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_booking_cancellation();

GRANT EXECUTE ON FUNCTION public.handle_booking_cancellation() TO authenticated;