/*
  # Correction des références de colonnes dans send_system_message
  
  1. Modifications
    - Remplacer l.user_id par l.landlord_id (la table listings n'a pas de colonne user_id)
    - Remplacer b.user_id par b.student_id (la table bookings n'a pas de colonne user_id)
  
  2. Impact
    - Corrige l'erreur "column l.user_id does not exist"
    - Permet l'envoi correct des messages système lors de la confirmation d'une réservation
*/

CREATE OR REPLACE FUNCTION send_system_message(
  p_booking_id uuid,
  p_message text,
  p_event text DEFAULT 'payment_required'
)
RETURNS uuid AS $$
DECLARE
  v_message_id uuid;
  v_listing_id uuid;
  v_landlord_id uuid;
  v_student_id uuid;
  v_topic text;
BEGIN
  -- Récupérer les infos de la réservation (CORRECTION: landlord_id et student_id)
  SELECT l.landlord_id, b.student_id, b.listing_id
  INTO v_landlord_id, v_student_id, v_listing_id
  FROM bookings b
  JOIN listings l ON l.id = b.listing_id
  WHERE b.id = p_booking_id;

  -- Générer le topic (même format que les autres messages)
  v_topic := v_student_id::text || '-' || v_listing_id::text;

  -- Créer le message système (sender_id NULL = message système)
  INSERT INTO messages (
    id,
    sender_id,
    recipient_id,
    listing_id,
    booking_id,
    content,
    event,
    topic,
    extension,
    is_read,
    private,
    created_at
  ) VALUES (
    gen_random_uuid(),
    NULL,
    v_student_id,
    v_listing_id,
    p_booking_id,
    p_message,
    p_event,
    v_topic,
    'system',
    false,
    false,
    NOW()
  )
  RETURNING id INTO v_message_id;

  RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;