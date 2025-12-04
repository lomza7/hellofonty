/*
  # Add Missing Student Feature Carousel Images

  1. New Data
    - Add missing student features:
      - Access guide
      - Community features
      - Free platform

  2. Notes
    - Using placeholder Pexels images
    - All features start as active by default
*/

-- Insert missing student feature images
INSERT INTO feature_carousel_images (feature_key, image_url, display_order, is_active) VALUES
  ('students.access', 'https://images.pexels.com/photos/279810/pexels-photo-279810.jpeg', 18, true),
  ('students.community', 'https://images.pexels.com/photos/1595385/pexels-photo-1595385.jpeg', 19, true),
  ('students.free', 'https://images.pexels.com/photos/259027/pexels-photo-259027.jpeg', 20, true)
ON CONFLICT (feature_key) DO NOTHING;
