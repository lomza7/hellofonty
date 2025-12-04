/*
  # Create feature carousel images table

  1. New Tables
    - `feature_carousel_images`
      - `id` (uuid, primary key)
      - `feature_key` (text) - Unique identifier for each feature (e.g., 'landlords.lease', 'students.search')
      - `image_url` (text) - URL of the image
      - `display_order` (integer) - Order in which the feature appears
      - `is_active` (boolean) - Whether the feature is currently active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `feature_carousel_images` table
    - Add policy for public read access (anyone can view features)
    - Add policy for admin write access (only admins can modify)

  3. Initial Data
    - Populate table with default feature images for landlords
*/

-- Create the table
CREATE TABLE IF NOT EXISTS feature_carousel_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text UNIQUE NOT NULL,
  image_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE feature_carousel_images ENABLE ROW LEVEL SECURITY;

-- Policy for public read access
CREATE POLICY "Anyone can view active features"
  ON feature_carousel_images
  FOR SELECT
  USING (is_active = true);

-- Policy for admin read all
CREATE POLICY "Admins can view all features"
  ON feature_carousel_images
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy for admin insert
CREATE POLICY "Admins can insert features"
  ON feature_carousel_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy for admin update
CREATE POLICY "Admins can update features"
  ON feature_carousel_images
  FOR UPDATE
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

-- Policy for admin delete
CREATE POLICY "Admins can delete features"
  ON feature_carousel_images
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insert default feature images for landlords
INSERT INTO feature_carousel_images (feature_key, image_url, display_order, is_active) VALUES
  ('landlords.lease', '/6.png', 1, true),
  ('landlords.payment', 'https://images.pexels.com/photos/4968630/pexels-photo-4968630.jpeg', 2, true),
  ('landlords.inventory', 'https://images.pexels.com/photos/7078666/pexels-photo-7078666.jpeg', 3, true),
  ('landlords.listings', 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg', 4, true),
  ('landlords.bookings', 'https://images.pexels.com/photos/5717546/pexels-photo-5717546.jpeg', 5, true),
  ('landlords.access', 'https://images.pexels.com/photos/5705471/pexels-photo-5705471.jpeg', 6, true),
  ('landlords.verification', 'https://images.pexels.com/photos/5668838/pexels-photo-5668838.jpeg', 7, true),
  ('landlords.messaging', 'https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg', 8, true),
  ('landlords.stats', 'https://images.pexels.com/photos/7947664/pexels-photo-7947664.jpeg', 9, true)
ON CONFLICT (feature_key) DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_feature_carousel_images_updated_at ON feature_carousel_images;

CREATE TRIGGER update_feature_carousel_images_updated_at
  BEFORE UPDATE ON feature_carousel_images
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
