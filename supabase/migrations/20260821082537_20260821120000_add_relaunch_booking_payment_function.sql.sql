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
