-- Table principale des états des lieux
CREATE TABLE IF NOT EXISTS property_inventories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  lease_id uuid REFERENCES leases(id) ON DELETE SET NULL,
  inventory_type text NOT NULL CHECK (inventory_type IN ('check_in', 'check_out')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_signatures', 'signed', 'archived')),
  landlord_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  tenant_email text,
  tenant_name text,
  inspection_date date NOT NULL,
  check_in_inventory_id uuid REFERENCES property_inventories(id) ON DELETE SET NULL,
  general_notes text,
  meter_readings jsonb DEFAULT '{}'::jsonb,
  keys_info jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz
);

-- Table des pièces à inspecter
CREATE TABLE IF NOT EXISTS inventory_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid REFERENCES property_inventories(id) ON DELETE CASCADE NOT NULL,
  room_type text NOT NULL CHECK (room_type IN ('living_room', 'bedroom', 'kitchen', 'bathroom', 'entrance', 'hallway', 'other')),
  room_name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Table des éléments à vérifier
CREATE TABLE IF NOT EXISTS inventory_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES inventory_rooms(id) ON DELETE CASCADE NOT NULL,
  element_category text NOT NULL CHECK (element_category IN ('walls', 'floors', 'ceiling', 'windows', 'doors', 'fixtures', 'furniture', 'appliances', 'plumbing', 'electrical', 'other')),
  element_name text NOT NULL,
  condition_rating text CHECK (condition_rating IN ('excellent', 'good', 'fair', 'poor', 'damaged')),
  notes text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Table des photos
CREATE TABLE IF NOT EXISTS inventory_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  element_id uuid REFERENCES inventory_elements(id) ON DELETE CASCADE NOT NULL,
  photo_url text NOT NULL,
  caption text,
  order_index integer NOT NULL DEFAULT 0,
  uploaded_at timestamptz DEFAULT now() NOT NULL
);

-- Table des signatures
CREATE TABLE IF NOT EXISTS inventory_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid REFERENCES property_inventories(id) ON DELETE CASCADE NOT NULL,
  signer_type text NOT NULL CHECK (signer_type IN ('landlord', 'tenant')),
  signer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  signer_name text NOT NULL,
  signer_email text NOT NULL,
  signature_data text NOT NULL,
  ip_address text,
  signed_at timestamptz DEFAULT now() NOT NULL
);

-- Templates de pièces prédéfinies
CREATE TABLE IF NOT EXISTS default_room_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type text UNIQUE NOT NULL,
  display_name_fr text NOT NULL,
  display_name_en text NOT NULL,
  order_index integer NOT NULL DEFAULT 0
);

-- Templates d'éléments prédéfinis
CREATE TABLE IF NOT EXISTS default_element_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type text NOT NULL,
  element_category text NOT NULL,
  element_name_fr text NOT NULL,
  element_name_en text NOT NULL,
  order_index integer NOT NULL DEFAULT 0
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_property_inventories_listing ON property_inventories(listing_id);
CREATE INDEX IF NOT EXISTS idx_property_inventories_landlord ON property_inventories(landlord_id);
CREATE INDEX IF NOT EXISTS idx_property_inventories_tenant ON property_inventories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_property_inventories_status ON property_inventories(status);
CREATE INDEX IF NOT EXISTS idx_inventory_rooms_inventory ON inventory_rooms(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_elements_room ON inventory_elements(room_id);
CREATE INDEX IF NOT EXISTS idx_inventory_photos_element ON inventory_photos(element_id);
CREATE INDEX IF NOT EXISTS idx_inventory_signatures_inventory ON inventory_signatures(inventory_id);

-- Enable RLS
ALTER TABLE property_inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE default_room_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE default_element_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour property_inventories
DROP POLICY IF EXISTS "Landlords can view own inventories" ON property_inventories;
CREATE POLICY "Landlords can view own inventories"
  ON property_inventories FOR SELECT
  TO authenticated
  USING (landlord_id = auth.uid());

DROP POLICY IF EXISTS "Landlords can create inventories" ON property_inventories;
CREATE POLICY "Landlords can create inventories"
  ON property_inventories FOR INSERT
  TO authenticated
  WITH CHECK (
    landlord_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = property_inventories.listing_id
      AND listings.landlord_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Landlords can update own draft inventories" ON property_inventories;
CREATE POLICY "Landlords can update own draft inventories"
  ON property_inventories FOR UPDATE
  TO authenticated
  USING (landlord_id = auth.uid() AND status = 'draft')
  WITH CHECK (landlord_id = auth.uid() AND status = 'draft');

DROP POLICY IF EXISTS "Landlords can delete own draft inventories" ON property_inventories;
CREATE POLICY "Landlords can delete own draft inventories"
  ON property_inventories FOR DELETE
  TO authenticated
  USING (landlord_id = auth.uid() AND status = 'draft');

DROP POLICY IF EXISTS "Admins can manage all inventories" ON property_inventories;
CREATE POLICY "Admins can manage all inventories"
  ON property_inventories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies pour inventory_rooms
DROP POLICY IF EXISTS "Users can view rooms of their inventories" ON inventory_rooms;
CREATE POLICY "Users can view rooms of their inventories"
  ON inventory_rooms FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM property_inventories
      WHERE property_inventories.id = inventory_rooms.inventory_id
      AND (property_inventories.landlord_id = auth.uid() OR property_inventories.tenant_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Landlords can manage rooms in draft inventories" ON inventory_rooms;
CREATE POLICY "Landlords can manage rooms in draft inventories"
  ON inventory_rooms FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM property_inventories
      WHERE property_inventories.id = inventory_rooms.inventory_id
      AND property_inventories.landlord_id = auth.uid()
      AND property_inventories.status = 'draft'
    )
  );

-- RLS Policies pour inventory_elements
DROP POLICY IF EXISTS "Users can view elements of their inventories" ON inventory_elements;
CREATE POLICY "Users can view elements of their inventories"
  ON inventory_elements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM inventory_rooms
      JOIN property_inventories ON property_inventories.id = inventory_rooms.inventory_id
      WHERE inventory_rooms.id = inventory_elements.room_id
      AND (property_inventories.landlord_id = auth.uid() OR property_inventories.tenant_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Landlords can manage elements in draft inventories" ON inventory_elements;
CREATE POLICY "Landlords can manage elements in draft inventories"
  ON inventory_elements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM inventory_rooms
      JOIN property_inventories ON property_inventories.id = inventory_rooms.inventory_id
      WHERE inventory_rooms.id = inventory_elements.room_id
      AND property_inventories.landlord_id = auth.uid()
      AND property_inventories.status = 'draft'
    )
  );

-- RLS Policies pour inventory_photos
DROP POLICY IF EXISTS "Users can view photos of their inventories" ON inventory_photos;
CREATE POLICY "Users can view photos of their inventories"
  ON inventory_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM inventory_elements
      JOIN inventory_rooms ON inventory_rooms.id = inventory_elements.room_id
      JOIN property_inventories ON property_inventories.id = inventory_rooms.inventory_id
      WHERE inventory_elements.id = inventory_photos.element_id
      AND (property_inventories.landlord_id = auth.uid() OR property_inventories.tenant_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Landlords can manage photos in draft inventories" ON inventory_photos;
CREATE POLICY "Landlords can manage photos in draft inventories"
  ON inventory_photos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM inventory_elements
      JOIN inventory_rooms ON inventory_rooms.id = inventory_elements.room_id
      JOIN property_inventories ON property_inventories.id = inventory_rooms.inventory_id
      WHERE inventory_elements.id = inventory_photos.element_id
      AND property_inventories.landlord_id = auth.uid()
      AND property_inventories.status = 'draft'
    )
  );

-- RLS Policies pour inventory_signatures
DROP POLICY IF EXISTS "Users can view signatures of their inventories" ON inventory_signatures;
CREATE POLICY "Users can view signatures of their inventories"
  ON inventory_signatures FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM property_inventories
      WHERE property_inventories.id = inventory_signatures.inventory_id
      AND (property_inventories.landlord_id = auth.uid() OR property_inventories.tenant_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can sign their inventories" ON inventory_signatures;
CREATE POLICY "Users can sign their inventories"
  ON inventory_signatures FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM property_inventories
      WHERE property_inventories.id = inventory_signatures.inventory_id
      AND (
        (inventory_signatures.signer_type = 'landlord' AND property_inventories.landlord_id = auth.uid()) OR
        (inventory_signatures.signer_type = 'tenant' AND property_inventories.tenant_id = auth.uid())
      )
    )
  );

-- RLS Policies pour les templates (lecture publique pour utilisateurs authentifiés)
DROP POLICY IF EXISTS "Authenticated users can view room templates" ON default_room_templates;
CREATE POLICY "Authenticated users can view room templates"
  ON default_room_templates FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can view element templates" ON default_element_templates;
CREATE POLICY "Authenticated users can view element templates"
  ON default_element_templates FOR SELECT
  TO authenticated
  USING (true);

-- Admins peuvent gérer les templates
DROP POLICY IF EXISTS "Admins can manage room templates" ON default_room_templates;
CREATE POLICY "Admins can manage room templates"
  ON default_room_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can manage element templates" ON default_element_templates;
CREATE POLICY "Admins can manage element templates"
  ON default_element_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insérer les templates de pièces prédéfinies
INSERT INTO default_room_templates (room_type, display_name_fr, display_name_en, order_index) VALUES
  ('entrance', 'Entrée', 'Entrance', 1),
  ('living_room', 'Salon', 'Living Room', 2),
  ('kitchen', 'Cuisine', 'Kitchen', 3),
  ('bedroom', 'Chambre', 'Bedroom', 4),
  ('bathroom', 'Salle de bain', 'Bathroom', 5),
  ('hallway', 'Couloir', 'Hallway', 6),
  ('other', 'Autre', 'Other', 7)
ON CONFLICT (room_type) DO NOTHING;

-- Insérer les templates d'éléments prédéfinis
INSERT INTO default_element_templates (room_type, element_category, element_name_fr, element_name_en, order_index) VALUES
  ('living_room', 'walls', 'Murs', 'Walls', 1),
  ('living_room', 'floors', 'Sol/Parquet', 'Floor/Parquet', 2),
  ('living_room', 'ceiling', 'Plafond', 'Ceiling', 3),
  ('living_room', 'windows', 'Fenêtres', 'Windows', 4),
  ('living_room', 'windows', 'Volets/Stores', 'Shutters/Blinds', 5),
  ('living_room', 'doors', 'Porte d''entrée', 'Entrance Door', 6),
  ('living_room', 'fixtures', 'Radiateur(s)', 'Radiator(s)', 7),
  ('living_room', 'electrical', 'Prises électriques', 'Electrical Outlets', 8),
  ('living_room', 'electrical', 'Interrupteurs', 'Light Switches', 9),
  ('living_room', 'fixtures', 'Luminaires', 'Light Fixtures', 10),
  ('kitchen', 'walls', 'Murs/Carrelage', 'Walls/Tiles', 1),
  ('kitchen', 'floors', 'Sol', 'Floor', 2),
  ('kitchen', 'ceiling', 'Plafond', 'Ceiling', 3),
  ('kitchen', 'windows', 'Fenêtre', 'Window', 4),
  ('kitchen', 'fixtures', 'Placard(s)', 'Cabinet(s)', 5),
  ('kitchen', 'fixtures', 'Plan de travail', 'Countertop', 6),
  ('kitchen', 'plumbing', 'Évier', 'Sink', 7),
  ('kitchen', 'plumbing', 'Robinetterie', 'Faucet', 8),
  ('kitchen', 'appliances', 'Plaques de cuisson', 'Cooktop', 9),
  ('kitchen', 'appliances', 'Four', 'Oven', 10),
  ('kitchen', 'appliances', 'Hotte aspirante', 'Range Hood', 11),
  ('kitchen', 'appliances', 'Réfrigérateur', 'Refrigerator', 12),
  ('kitchen', 'fixtures', 'Radiateur', 'Radiator', 13),
  ('kitchen', 'electrical', 'Prises électriques', 'Electrical Outlets', 14),
  ('bedroom', 'walls', 'Murs', 'Walls', 1),
  ('bedroom', 'floors', 'Sol/Parquet', 'Floor/Parquet', 2),
  ('bedroom', 'ceiling', 'Plafond', 'Ceiling', 3),
  ('bedroom', 'windows', 'Fenêtre(s)', 'Window(s)', 4),
  ('bedroom', 'windows', 'Volets/Stores', 'Shutters/Blinds', 5),
  ('bedroom', 'doors', 'Porte', 'Door', 6),
  ('bedroom', 'fixtures', 'Placard/Penderie', 'Closet/Wardrobe', 7),
  ('bedroom', 'fixtures', 'Radiateur', 'Radiator', 8),
  ('bedroom', 'electrical', 'Prises électriques', 'Electrical Outlets', 9),
  ('bedroom', 'electrical', 'Interrupteurs', 'Light Switches', 10),
  ('bedroom', 'fixtures', 'Luminaires', 'Light Fixtures', 11),
  ('bathroom', 'walls', 'Murs/Carrelage', 'Walls/Tiles', 1),
  ('bathroom', 'floors', 'Sol/Carrelage', 'Floor/Tiles', 2),
  ('bathroom', 'ceiling', 'Plafond', 'Ceiling', 3),
  ('bathroom', 'windows', 'Fenêtre', 'Window', 4),
  ('bathroom', 'plumbing', 'Lavabo', 'Sink', 5),
  ('bathroom', 'plumbing', 'Robinetterie lavabo', 'Sink Faucet', 6),
  ('bathroom', 'plumbing', 'Baignoire', 'Bathtub', 7),
  ('bathroom', 'plumbing', 'Douche', 'Shower', 8),
  ('bathroom', 'plumbing', 'Robinetterie douche', 'Shower Faucet', 9),
  ('bathroom', 'plumbing', 'Toilettes', 'Toilet', 10),
  ('bathroom', 'fixtures', 'Miroir', 'Mirror', 11),
  ('bathroom', 'fixtures', 'Meuble de rangement', 'Storage Cabinet', 12),
  ('bathroom', 'fixtures', 'Radiateur/Sèche-serviettes', 'Radiator/Towel Warmer', 13),
  ('bathroom', 'electrical', 'Prises électriques', 'Electrical Outlets', 14),
  ('bathroom', 'fixtures', 'VMC/Aération', 'Ventilation', 15),
  ('entrance', 'walls', 'Murs', 'Walls', 1),
  ('entrance', 'floors', 'Sol', 'Floor', 2),
  ('entrance', 'ceiling', 'Plafond', 'Ceiling', 3),
  ('entrance', 'doors', 'Porte d''entrée', 'Entrance Door', 4),
  ('entrance', 'doors', 'Serrure', 'Lock', 5),
  ('entrance', 'doors', 'Interphone/Digicode', 'Intercom/Keypad', 6),
  ('entrance', 'electrical', 'Interrupteurs', 'Light Switches', 7),
  ('entrance', 'fixtures', 'Luminaires', 'Light Fixtures', 8),
  ('hallway', 'walls', 'Murs', 'Walls', 1),
  ('hallway', 'floors', 'Sol', 'Floor', 2),
  ('hallway', 'ceiling', 'Plafond', 'Ceiling', 3),
  ('hallway', 'doors', 'Porte(s)', 'Door(s)', 4),
  ('hallway', 'fixtures', 'Placard(s)', 'Closet(s)', 5),
  ('hallway', 'electrical', 'Interrupteurs', 'Light Switches', 6),
  ('hallway', 'fixtures', 'Luminaires', 'Light Fixtures', 7);

-- Créer le bucket pour les photos d'états des lieux
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inventory-photos',
  'inventory-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Policy : Les propriétaires peuvent uploader des photos pour leurs états des lieux en brouillon
DROP POLICY IF EXISTS "Landlords can upload photos for draft inventories" ON storage.objects;
CREATE POLICY "Landlords can upload photos for draft inventories"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'inventory-photos' AND
    (storage.foldername(name))[1] IN (
      SELECT pi.id::text
      FROM property_inventories pi
      WHERE pi.landlord_id = auth.uid()
      AND pi.status = 'draft'
    )
  );

-- Policy : Les utilisateurs concernés peuvent voir les photos de leurs états des lieux
DROP POLICY IF EXISTS "Users can view photos of their inventories" ON storage.objects;
CREATE POLICY "Users can view photos of their inventories"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'inventory-photos' AND
    (storage.foldername(name))[1] IN (
      SELECT pi.id::text
      FROM property_inventories pi
      WHERE pi.landlord_id = auth.uid() OR pi.tenant_id = auth.uid()
    )
  );

-- Policy : Les propriétaires peuvent supprimer les photos de leurs brouillons
DROP POLICY IF EXISTS "Landlords can delete photos from draft inventories" ON storage.objects;
CREATE POLICY "Landlords can delete photos from draft inventories"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'inventory-photos' AND
    (storage.foldername(name))[1] IN (
      SELECT pi.id::text
      FROM property_inventories pi
      WHERE pi.landlord_id = auth.uid()
      AND pi.status = 'draft'
    )
  );

-- Policy : Les admins peuvent tout gérer
DROP POLICY IF EXISTS "Admins can manage all inventory photos" ON storage.objects;
CREATE POLICY "Admins can manage all inventory photos"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'inventory-photos' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Fonction get_user_email
CREATE OR REPLACE FUNCTION get_user_email(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email text;
BEGIN
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_id;
  
  RETURN user_email;
END;
$$;

-- Ajouter booking_id à property_inventories
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

-- Ajout des colonnes Stripe Connect à la table profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'stripe_account_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_account_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'stripe_onboarding_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_onboarding_status text DEFAULT 'not_connected'
      CHECK (stripe_onboarding_status IN ('not_connected', 'pending', 'complete'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'stripe_charges_enabled'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_charges_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'stripe_payouts_enabled'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_payouts_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'stripe_details_submitted'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_details_submitted boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'stripe_onboarding_updated_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_onboarding_updated_at timestamptz;
  END IF;
END $$;

-- Créer un index sur stripe_account_id pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_account_id ON profiles(stripe_account_id);

-- Commentaires pour documenter les colonnes
COMMENT ON COLUMN profiles.stripe_account_id IS 'Identifiant du compte Stripe Connect du propriétaire';
COMMENT ON COLUMN profiles.stripe_onboarding_status IS 'Statut de l''onboarding Stripe Connect (not_connected, pending, complete)';
COMMENT ON COLUMN profiles.stripe_charges_enabled IS 'Le compte peut recevoir des paiements';
COMMENT ON COLUMN profiles.stripe_payouts_enabled IS 'Le compte peut recevoir des virements bancaires';
COMMENT ON COLUMN profiles.stripe_details_submitted IS 'Les détails ont été soumis à Stripe pour vérification';
COMMENT ON COLUMN profiles.stripe_onboarding_updated_at IS 'Date de dernière mise à jour du statut Stripe';
