-- Retry batch 7: public stats, English features, security deposit, realtime, access guides

DROP POLICY IF EXISTS "Profils lisibles publiquement pour les statistiques" ON profiles;
CREATE POLICY "Profils lisibles publiquement pour les statistiques"
  ON profiles FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Listings actifs visibles publiquement" ON listings;
CREATE POLICY "Listings actifs visibles publiquement"
  ON listings FOR SELECT
  TO anon
  USING (is_active = true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pricing_plans' AND column_name = 'features_en'
  ) THEN
    ALTER TABLE pricing_plans ADD COLUMN features_en text[] DEFAULT '{}';
  END IF;
END $$;

UPDATE pricing_plans
SET features_en = ARRAY[
  'Publish 1 listing',
  'Basic features'
]
WHERE name = 'Gratuit' AND type = 'landlord';

UPDATE pricing_plans
SET features_en = ARRAY[
  'Unlimited listings',
  'Availability calendar',
  'Featured placement',
  'Advanced statistics',
  'Priority support'
]
WHERE name = 'Premium' AND type = 'landlord';

UPDATE pricing_plans
SET features_en = ARRAY[
  'Service fees',
  'Booking insurance',
  'Support 24/7'
]
WHERE name = 'Frais de réservation' AND type = 'student';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'security_deposit'
  ) THEN
    ALTER TABLE listings ADD COLUMN security_deposit numeric;
  END IF;
END $$;

ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE bookings REPLICA IDENTITY FULL;

CREATE TABLE IF NOT EXISTS access_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid UNIQUE NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  access_type text DEFAULT 'boite_a_cles' CHECK (access_type IN ('boite_a_cles', 'remise_en_main_propre', 'autre')),
  access_instructions text DEFAULT '',
  wifi_ssid text DEFAULT '',
  wifi_password text DEFAULT '',
  parking_info text DEFAULT '',
  access_photos text[] DEFAULT '{}',
  access_video text DEFAULT '',
  additional_info text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE access_guides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Landlords can view their own access guides" ON access_guides;
CREATE POLICY "Landlords can view their own access guides"
  ON access_guides FOR SELECT
  TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Landlords can create access guides for their listings" ON access_guides;
CREATE POLICY "Landlords can create access guides for their listings"
  ON access_guides FOR INSERT
  TO authenticated
  WITH CHECK (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Landlords can update their own access guides" ON access_guides;
CREATE POLICY "Landlords can update their own access guides"
  ON access_guides FOR UPDATE
  TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  )
  WITH CHECK (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Landlords can delete their own access guides" ON access_guides;
CREATE POLICY "Landlords can delete their own access guides"
  ON access_guides FOR DELETE
  TO authenticated
  USING (
    listing_id IN (
      SELECT id FROM listings WHERE landlord_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can view access guides for confirmed bookings" ON access_guides;
CREATE POLICY "Students can view access guides for confirmed bookings"
  ON access_guides FOR SELECT
  TO authenticated
  USING (
    listing_id IN (
      SELECT listing_id FROM bookings 
      WHERE student_id = auth.uid() 
      AND status = 'confirmed'
    )
  );

CREATE INDEX IF NOT EXISTS idx_access_guides_listing_id ON access_guides(listing_id);