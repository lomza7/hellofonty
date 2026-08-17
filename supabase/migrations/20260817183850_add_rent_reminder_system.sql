/*
# Système de relance des loyers

1. Nouveaux champs sur `rent_payments`
   - `last_reminder_sent_at` (timestamptz, nullable) : date de la dernière relance envoyée, pour éviter les doublons.
   - `auto_reminder_enabled` (boolean, default true) : permet d'activer/désactiver la relance automatique par loyer individuel. Modifiable par l'admin et par le manager du logement concerné.

2. Nouvelle table `rent_reminder_settings`
   - Table de configuration globale (une seule ligne) avec un champ `auto_reminder_enabled` (boolean, default true) contrôlant la relance automatique pour toute la plateforme.
   - RLS : admin peut tout faire, les autres peuvent lire.

3. Nouveaux types de notifications
   - Ajout de `rent_reminder` et `rent_overdue` à la contrainte `notifications_type_check`.

4. Sécurité (RLS)
   - `bookings` : ajout d'une policy SELECT pour les admins (managers ont déjà la leur via `is_assigned_manager`).
   - `rent_payments` : ajout d'une policy SELECT pour les managers des logements concernés, et d'une policy UPDATE pour les admins (pour mettre à jour `auto_reminder_enabled`, `last_reminder_sent_at`, `status`).

5. Cron job quotidien
   - Programme un job `pg_cron` à 8h00 chaque jour qui appelle l'edge function `send-rent-reminder` via `pg_net`.
*/

-- 1. Nouveaux champs sur rent_payments
ALTER TABLE rent_payments ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz;
ALTER TABLE rent_payments ADD COLUMN IF NOT EXISTS auto_reminder_enabled boolean NOT NULL DEFAULT true;

-- 2. Table de configuration globale
CREATE TABLE IF NOT EXISTS rent_reminder_settings (
  id integer PRIMARY KEY DEFAULT 1,
  auto_reminder_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE rent_reminder_settings ENABLE ROW LEVEL SECURITY;

-- Insérer la ligne par défaut
INSERT INTO rent_reminder_settings (id, auto_reminder_enabled)
VALUES (1, true)
ON CONFLICT (id) DO NOTHING;

-- Policies pour rent_reminder_settings
DROP POLICY IF EXISTS "Admins manage rent reminder settings" ON rent_reminder_settings;
CREATE POLICY "Admins manage rent reminder settings"
  ON rent_reminder_settings FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "Managers can read rent reminder settings" ON rent_reminder_settings;
CREATE POLICY "Managers can read rent reminder settings"
  ON rent_reminder_settings FOR SELECT
  TO authenticated
  USING (true);

-- 3. Ajout des types de notifications
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY['message', 'booking_request', 'booking_confirmed', 'booking_cancelled', 'lease_signature_request', 'lease_signed', 'deposit_refund', 'rent_reminder', 'rent_overdue'])
);

-- 4. Policies

-- bookings : admin SELECT
DROP POLICY IF EXISTS "Admins can view all bookings" ON bookings;
CREATE POLICY "Admins can view all bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- rent_payments : manager SELECT (via is_assigned_manager sur le listing du booking)
DROP POLICY IF EXISTS "Managers can view rent payments for assigned listings" ON rent_payments;
CREATE POLICY "Managers can view rent payments for assigned listings"
  ON rent_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN manager_assignments ma ON ma.listing_id = b.listing_id
      WHERE b.id = rent_payments.booking_id
      AND ma.manager_id = auth.uid()
    )
  );

-- rent_payments : admin UPDATE (pour auto_reminder_enabled, last_reminder_sent_at, status)
DROP POLICY IF EXISTS "Admins can update rent payments" ON rent_payments;
CREATE POLICY "Admins can update rent payments"
  ON rent_payments FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- rent_payments : manager UPDATE (pour auto_reminder_enabled et last_reminder_sent_at)
DROP POLICY IF EXISTS "Managers can update rent payments for assigned listings" ON rent_payments;
CREATE POLICY "Managers can update rent payments for assigned listings"
  ON rent_payments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN manager_assignments ma ON ma.listing_id = b.listing_id
      WHERE b.id = rent_payments.booking_id
      AND ma.manager_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN manager_assignments ma ON ma.listing_id = b.listing_id
      WHERE b.id = rent_payments.booking_id
      AND ma.manager_id = auth.uid()
    )
  );

-- Index pour les relances
CREATE INDEX IF NOT EXISTS idx_rent_payments_reminder ON rent_payments(status, payment_date) WHERE status = 'pending';

-- 5. Cron job quotidien à 8h00
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('send-rent-reminder-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-rent-reminder-daily');

SELECT cron.schedule(
  'send-rent-reminder-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-rent-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
