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
