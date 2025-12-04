/*
  # Add Student Feature Carousel Images

  1. New Data
    - Add feature carousel images for students section
    - Features include:
      - Search and discovery
      - Booking system
      - Verified listings
      - Document management
      - Secure messaging
      - Reviews and ratings
      - Favorites
      - Profile management

  2. Notes
    - Using placeholder Pexels images
    - All features start as active by default
    - Display order starts at 10 to avoid conflicts with landlord features
*/

-- Insert default feature images for students
INSERT INTO feature_carousel_images (feature_key, image_url, display_order, is_active) VALUES
  ('students.search', 'https://images.pexels.com/photos/1370704/pexels-photo-1370704.jpeg', 10, true),
  ('students.booking', 'https://images.pexels.com/photos/5717546/pexels-photo-5717546.jpeg', 11, true),
  ('students.verified', 'https://images.pexels.com/photos/5668838/pexels-photo-5668838.jpeg', 12, true),
  ('students.documents', 'https://images.pexels.com/photos/6476589/pexels-photo-6476589.jpeg', 13, true),
  ('students.messaging', 'https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg', 14, true),
  ('students.reviews', 'https://images.pexels.com/photos/7189028/pexels-photo-7189028.jpeg', 15, true),
  ('students.favorites', 'https://images.pexels.com/photos/4050315/pexels-photo-4050315.jpeg', 16, true),
  ('students.profile', 'https://images.pexels.com/photos/3760263/pexels-photo-3760263.jpeg', 17, true)
ON CONFLICT (feature_key) DO NOTHING;
