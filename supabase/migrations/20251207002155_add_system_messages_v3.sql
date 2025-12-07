/*
  # Messages système automatiques

  1. Modifications
    - Permettre sender_id NULL pour les messages système
    - Identifier les messages système par event = 'payment_required' ou autre event système

  2. Sécurité
    - Seules les fonctions serveur peuvent créer des messages système
*/

-- Modifier la table messages pour permettre sender_id NULL
ALTER TABLE messages 
ALTER COLUMN sender_id DROP NOT NULL;

-- Créer une fonction pour envoyer un message système
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
  -- Récupérer les infos de la réservation
  SELECT l.user_id, b.user_id, b.listing_id
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
    NULL,  -- NULL = message système Hellofonty
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

-- Fonction trigger pour envoyer automatiquement un message de paiement
CREATE OR REPLACE FUNCTION auto_send_payment_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Si le statut passe à confirmed, envoyer un message système
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    PERFORM send_system_message(
      NEW.id,
      'Félicitations ! Votre réservation a été confirmée par le propriétaire. Pour finaliser votre réservation, vous devez effectuer le paiement dans les 7 jours. Le montant total inclut le loyer, la caution et les frais de service. Cliquez sur le bouton "Payer maintenant" ci-dessous pour procéder au paiement.',
      'payment_required'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour envoyer le message automatiquement
DROP TRIGGER IF EXISTS trigger_auto_send_payment_message ON bookings;
CREATE TRIGGER trigger_auto_send_payment_message
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION auto_send_payment_message();