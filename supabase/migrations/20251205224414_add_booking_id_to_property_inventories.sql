/*
  # Ajouter booking_id à property_inventories

  1. Modifications
    - Ajoute la colonne `booking_id` à la table `property_inventories`
    - Crée une contrainte de clé étrangère vers la table `bookings`
    - Permet de lier directement un état des lieux à une réservation validée
  
  2. Note
    - La colonne est nullable car certains états des lieux peuvent être créés sans réservation
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'property_inventories' AND column_name = 'booking_id'
  ) THEN
    ALTER TABLE property_inventories 
    ADD COLUMN booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL;
  END IF;
END $$;