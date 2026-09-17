-- Correction du trigger de calcul des montants de paiement
CREATE OR REPLACE FUNCTION public.set_payment_deadline()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_listing_price numeric;
  v_security_deposit numeric;
  v_nights integer;
  v_rent_amount numeric;
  v_service_fee numeric;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') AND NEW.payment_deadline IS NULL THEN
    NEW.payment_deadline := NOW() + INTERVAL '7 days';
    NEW.payment_status := 'pending';
    
    IF NEW.payment_amount IS NULL THEN
      SELECT price_per_month, security_deposit
      INTO v_listing_price, v_security_deposit
      FROM listings
      WHERE id = NEW.listing_id;
      
      v_nights := EXTRACT(DAY FROM (NEW.end_date - NEW.start_date));
      
      v_rent_amount := v_listing_price * v_nights;
      
      SELECT COALESCE(setting_value::numeric, 50) INTO v_service_fee
      FROM platform_settings
      WHERE setting_key = 'booking_service_fee';
      
      NEW.rent_amount := v_rent_amount;
      NEW.deposit_amount := COALESCE(v_security_deposit, 0);
      NEW.service_fee := v_service_fee;
      NEW.payment_amount := v_rent_amount + COALESCE(v_security_deposit, 0) + v_service_fee;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Correction du calcul des nuits
CREATE OR REPLACE FUNCTION public.set_payment_deadline()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_listing_price numeric;
  v_security_deposit numeric;
  v_nights integer;
  v_rent_amount numeric;
  v_service_fee numeric;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') AND NEW.payment_deadline IS NULL THEN
    NEW.payment_deadline := NOW() + INTERVAL '7 days';
    NEW.payment_status := 'pending';
    
    IF NEW.payment_amount IS NULL THEN
      SELECT price_per_month, security_deposit
      INTO v_listing_price, v_security_deposit
      FROM listings
      WHERE id = NEW.listing_id;
      
      v_nights := NEW.end_date - NEW.start_date;
      
      v_rent_amount := v_listing_price * v_nights;
      
      SELECT COALESCE(setting_value::numeric, 50) INTO v_service_fee
      FROM platform_settings
      WHERE setting_key = 'booking_service_fee';
      
      NEW.rent_amount := v_rent_amount;
      NEW.deposit_amount := COALESCE(v_security_deposit, 0);
      NEW.service_fee := v_service_fee;
      NEW.payment_amount := v_rent_amount + COALESCE(v_security_deposit, 0) + v_service_fee;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Correction des références de colonnes dans send_system_message
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
  SELECT l.landlord_id, b.student_id, b.listing_id
  INTO v_landlord_id, v_student_id, v_listing_id
  FROM bookings b
  JOIN listings l ON l.id = b.listing_id
  WHERE b.id = p_booking_id;

  v_topic := v_student_id::text || '-' || v_listing_id::text;

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

-- Ajouter la colonne event à la table messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'event'
  ) THEN
    ALTER TABLE messages ADD COLUMN event text;
  END IF;
END $$;

-- Ajouter les colonnes manquantes à la table messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'topic'
  ) THEN
    ALTER TABLE messages ADD COLUMN topic text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'extension'
  ) THEN
    ALTER TABLE messages ADD COLUMN extension text NOT NULL DEFAULT 'message';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'payload'
  ) THEN
    ALTER TABLE messages ADD COLUMN payload jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'event'
  ) THEN
    ALTER TABLE messages ADD COLUMN event text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'private'
  ) THEN
    ALTER TABLE messages ADD COLUMN private boolean DEFAULT false;
  END IF;
END $$;
