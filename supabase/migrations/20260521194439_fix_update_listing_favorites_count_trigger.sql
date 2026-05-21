/*
  # Fix listing favorites count trigger on DELETE

  1. Problem
    - The `update_listing_favorites_count()` trigger fires on both INSERT and DELETE of favorites
    - On DELETE, `NEW` is NULL, causing a NOT NULL constraint violation when it tries to INSERT into listing_statistics
    - This blocks CASCADE deletes from listings -> favorites, preventing listing deletion

  2. Fix
    - Use `COALESCE(NEW.listing_id, OLD.listing_id)` to handle both INSERT and DELETE events
    - Add a guard clause: if the listing no longer exists (CASCADE delete in progress), skip the update
    - Return NEW for INSERT, OLD for DELETE
*/

CREATE OR REPLACE FUNCTION update_listing_favorites_count()
RETURNS TRIGGER AS $$
DECLARE
  v_listing_id uuid;
BEGIN
  v_listing_id := COALESCE(NEW.listing_id, OLD.listing_id);

  IF v_listing_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM listings WHERE id = v_listing_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO listing_statistics (listing_id, total_favorites)
  VALUES (v_listing_id, 0)
  ON CONFLICT (listing_id) DO NOTHING;

  UPDATE listing_statistics
  SET 
    total_favorites = (
      SELECT COUNT(*) 
      FROM favorites 
      WHERE listing_id = v_listing_id
    ),
    updated_at = now()
  WHERE listing_id = v_listing_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;