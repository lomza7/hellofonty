-- Système de paiement pour les réservations
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'expired', 'refunded')),
ADD COLUMN IF NOT EXISTS payment_deadline timestamptz,
ADD COLUMN IF NOT EXISTS payment_amount numeric(10, 2),
ADD COLUMN IF NOT EXISTS rent_amount numeric(10, 2),
ADD COLUMN IF NOT EXISTS deposit_amount numeric(10, 2),
ADD COLUMN IF NOT EXISTS service_fee numeric(10, 2),
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_deadline ON bookings(payment_deadline) WHERE payment_deadline IS NOT NULL;

CREATE OR REPLACE FUNCTION set_payment_deadline()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' AND NEW.payment_deadline IS NULL THEN
    NEW.payment_deadline := NOW() + INTERVAL '7 days';
    NEW.payment_status := 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_payment_deadline ON bookings;
CREATE TRIGGER trigger_set_payment_deadline
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_payment_deadline();

-- Messages système automatiques
ALTER TABLE messages 
ALTER COLUMN sender_id DROP NOT NULL;

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
  SELECT l.user_id, b.user_id, b.listing_id
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

CREATE OR REPLACE FUNCTION auto_send_payment_message()
RETURNS TRIGGER AS $$
BEGIN
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

DROP TRIGGER IF EXISTS trigger_auto_send_payment_message ON bookings;
CREATE TRIGGER trigger_auto_send_payment_message
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION auto_send_payment_message();

-- Paramètres des frais de plateforme
CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read platform settings" ON platform_settings;
CREATE POLICY "Anyone can read platform settings"
  ON platform_settings
  FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "Only admins can update platform settings" ON platform_settings;
CREATE POLICY "Only admins can update platform settings"
  ON platform_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES 
  ('booking_service_fee', '50', 'Frais de service fixes pour chaque réservation (en euros)'),
  ('platform_fee_percentage', '5', 'Pourcentage prélevé par la plateforme sur le total')
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION get_platform_setting(p_key text)
RETURNS text AS $$
DECLARE
  v_value text;
BEGIN
  SELECT setting_value INTO v_value
  FROM platform_settings
  WHERE setting_key = p_key;
  
  RETURN v_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_platform_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_platform_settings_updated_at ON platform_settings;
CREATE TRIGGER trigger_update_platform_settings_updated_at
  BEFORE UPDATE ON platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_settings_updated_at();

-- Mise à jour du calcul des frais de service
CREATE OR REPLACE FUNCTION set_payment_deadline()
RETURNS TRIGGER AS $$
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
      SELECT price, security_deposit
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
$$ LANGUAGE plpgsql;

-- Conversion des frais de plateforme en montant fixe
DELETE FROM platform_settings WHERE setting_key = 'platform_fee_percentage';

INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES 
  ('platform_fee_amount', '390', 'Frais fixes prélevés par la plateforme pour chaque réservation (en euros)')
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    description = EXCLUDED.description;
