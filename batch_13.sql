/*
  # Correction du trigger de calcul des montants de paiement
  
  1. Changements
    - Mise à jour de la fonction `set_payment_deadline` pour utiliser `price_per_month` au lieu de `price`
    - La colonne `price` n'existe pas dans la table `listings`, elle s'appelle `price_per_month`
  
  2. Impact
    - Corrige l'erreur "column price does not exist" lors des confirmations de réservation
    - Permet le calcul correct des montants de paiement
*/

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
  -- Si le statut passe à confirmed et qu'il n'y a pas encore de deadline
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') AND NEW.payment_deadline IS NULL THEN
    NEW.payment_deadline := NOW() + INTERVAL '7 days';
    NEW.payment_status := 'pending';
    
    -- Si les montants ne sont pas déjà calculés, les calculer
    IF NEW.payment_amount IS NULL THEN
      -- Récupérer les infos du logement (CORRECTION: price_per_month au lieu de price)
      SELECT price_per_month, security_deposit
      INTO v_listing_price, v_security_deposit
      FROM listings
      WHERE id = NEW.listing_id;
      
      -- Calculer le nombre de nuits
      v_nights := EXTRACT(DAY FROM (NEW.end_date - NEW.start_date));
      
      -- Calculer le loyer
      v_rent_amount := v_listing_price * v_nights;
      
      -- Récupérer les frais de service fixes depuis les paramètres
      SELECT COALESCE(setting_value::numeric, 50) INTO v_service_fee
      FROM platform_settings
      WHERE setting_key = 'booking_service_fee';
      
      -- Définir les montants
      NEW.rent_amount := v_rent_amount;
      NEW.deposit_amount := COALESCE(v_security_deposit, 0);
      NEW.service_fee := v_service_fee;
      NEW.payment_amount := v_rent_amount + COALESCE(v_security_deposit, 0) + v_service_fee;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
/*
  # Correction du calcul des nuits dans le trigger de paiement
  
  1. Changements
    - Remplacement de EXTRACT(DAY FROM (NEW.end_date - NEW.start_date)) par une simple soustraction
    - En PostgreSQL, soustraire deux colonnes de type DATE retourne directement un INTEGER (nombre de jours)
    - EXTRACT ne peut pas être utilisé sur un INTEGER, seulement sur un INTERVAL
  
  2. Impact
    - Corrige l'erreur "function pg_catalog.extract(unknown, integer) does not exist"
    - Permet le calcul correct du nombre de nuits
*/

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
  -- Si le statut passe à confirmed et qu'il n'y a pas encore de deadline
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') AND NEW.payment_deadline IS NULL THEN
    NEW.payment_deadline := NOW() + INTERVAL '7 days';
    NEW.payment_status := 'pending';
    
    -- Si les montants ne sont pas déjà calculés, les calculer
    IF NEW.payment_amount IS NULL THEN
      -- Récupérer les infos du logement
      SELECT price_per_month, security_deposit
      INTO v_listing_price, v_security_deposit
      FROM listings
      WHERE id = NEW.listing_id;
      
      -- Calculer le nombre de nuits (CORRECTION: soustraction directe de dates)
      v_nights := NEW.end_date - NEW.start_date;
      
      -- Calculer le loyer
      v_rent_amount := v_listing_price * v_nights;
      
      -- Récupérer les frais de service fixes depuis les paramètres
      SELECT COALESCE(setting_value::numeric, 50) INTO v_service_fee
      FROM platform_settings
      WHERE setting_key = 'booking_service_fee';
      
      -- Définir les montants
      NEW.rent_amount := v_rent_amount;
      NEW.deposit_amount := COALESCE(v_security_deposit, 0);
      NEW.service_fee := v_service_fee;
      NEW.payment_amount := v_rent_amount + COALESCE(v_security_deposit, 0) + v_service_fee;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
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
/*
  # Ajouter la colonne event à la table messages
  
  1. Modifications
    - Ajouter la colonne event (text, nullable) à la table messages
    - Cette colonne est utilisée pour identifier le type de message système
  
  2. Impact
    - Permet aux messages système d'avoir un type (ex: 'payment_required')
    - Requis pour la fonction send_system_message
*/

-- Ajouter la colonne event si elle n'existe pas déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'event'
  ) THEN
    ALTER TABLE messages ADD COLUMN event text;
  END IF;
END $$;
/*
  # Ajouter les colonnes manquantes à la table messages
  
  1. Modifications
    - Ajouter la colonne topic (text) pour organiser les conversations
    - Ajouter la colonne extension (text) pour identifier le type de message
    - Ajouter la colonne payload (jsonb) pour données additionnelles
    - Ajouter la colonne event (text) pour les messages système
    - Ajouter la colonne private (boolean) pour les messages privés
  
  2. Impact
    - Permet aux messages système de fonctionner correctement
    - Compatible avec la fonction send_system_message
*/

-- Ajouter les colonnes manquantes si elles n'existent pas
DO $$
BEGIN
  -- Ajouter topic
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'topic'
  ) THEN
    ALTER TABLE messages ADD COLUMN topic text NOT NULL DEFAULT '';
  END IF;

  -- Ajouter extension
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'extension'
  ) THEN
    ALTER TABLE messages ADD COLUMN extension text NOT NULL DEFAULT 'message';
  END IF;

  -- Ajouter payload
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'payload'
  ) THEN
    ALTER TABLE messages ADD COLUMN payload jsonb;
  END IF;

  -- Ajouter event
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'event'
  ) THEN
    ALTER TABLE messages ADD COLUMN event text;
  END IF;

  -- Ajouter private
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'private'
  ) THEN
    ALTER TABLE messages ADD COLUMN private boolean DEFAULT false;
  END IF;
END $$;
