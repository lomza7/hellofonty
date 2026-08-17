/*
# Relance automatique par réservation

1. Nouveau champ sur `bookings`
   - `auto_reminder_enabled` (boolean, default true) : permet d'activer/désactiver la relance automatique pour toute une réservation. Modifiable par l'admin et le manager du logement.

2. Sécurité (RLS)
   - `bookings` : ajout d'une policy UPDATE pour les admins (ils peuvent déjà SELECT).
   - `bookings` : ajout d'une policy UPDATE pour les managers des logements concernés (via `can_manage_listing`).
*/

-- 1. Nouveau champ sur bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS auto_reminder_enabled boolean NOT NULL DEFAULT true;

-- 2. Policies

-- bookings : admin UPDATE
DROP POLICY IF EXISTS "Admins can update bookings" ON bookings;
CREATE POLICY "Admins can update bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- bookings : manager UPDATE (via can_manage_listing)
DROP POLICY IF EXISTS "Managers can update bookings of assigned listings" ON bookings;
CREATE POLICY "Managers can update bookings of assigned listings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (can_manage_listing(listing_id))
  WITH CHECK (can_manage_listing(listing_id));
