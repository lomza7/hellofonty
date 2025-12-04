/*
  # Ajouter booking_id à la table leases

  1. Modifications
    - Ajoute colonne `booking_id` (uuid, nullable, foreign key vers bookings)
    - Crée une contrainte unique sur booking_id pour éviter les doublons
    - Crée un index pour améliorer les performances

  2. Notes
    - booking_id est nullable car certains baux peuvent être créés sans réservation
    - La contrainte unique empêche qu'une même réservation ait plusieurs baux
*/

-- Ajouter la colonne booking_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leases' AND column_name = 'booking_id'
  ) THEN
    ALTER TABLE leases ADD COLUMN booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Créer une contrainte unique sur booking_id (ignorer les NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_booking_per_lease'
  ) THEN
    ALTER TABLE leases ADD CONSTRAINT unique_booking_per_lease UNIQUE (booking_id);
  END IF;
END $$;

-- Créer un index sur booking_id
CREATE INDEX IF NOT EXISTS idx_leases_booking ON leases(booking_id);
