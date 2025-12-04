/*
  # Créer les fonctions d'analytique pour le tableau de bord admin

  1. Nouvelles fonctions
    - `get_daily_user_growth(days)` - Retourne le nombre de nouveaux utilisateurs par jour
    - `get_daily_listing_growth(days)` - Retourne le nombre de nouvelles annonces par jour
    - `get_daily_booking_growth(days)` - Retourne le nombre de nouvelles réservations par jour
    - `get_daily_activity(days)` - Retourne l'activité quotidienne combinée

  2. Sécurité
    - Ces fonctions sont accessibles uniquement aux utilisateurs authentifiés
    - Elles ne retournent que des données agrégées (pas de données personnelles)
*/

-- Fonction pour obtenir la croissance quotidienne des utilisateurs
CREATE OR REPLACE FUNCTION get_daily_user_growth(days integer DEFAULT 30)
RETURNS TABLE (date date, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(created_at) as date,
    COUNT(*) as count
  FROM profiles
  WHERE created_at >= CURRENT_DATE - (days || ' days')::interval
  GROUP BY DATE(created_at)
  ORDER BY date DESC;
END;
$$;

-- Fonction pour obtenir la croissance quotidienne des annonces
CREATE OR REPLACE FUNCTION get_daily_listing_growth(days integer DEFAULT 30)
RETURNS TABLE (date date, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(created_at) as date,
    COUNT(*) as count
  FROM listings
  WHERE created_at >= CURRENT_DATE - (days || ' days')::interval
  GROUP BY DATE(created_at)
  ORDER BY date DESC;
END;
$$;

-- Fonction pour obtenir la croissance quotidienne des réservations
CREATE OR REPLACE FUNCTION get_daily_booking_growth(days integer DEFAULT 30)
RETURNS TABLE (date date, count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(created_at) as date,
    COUNT(*) as count
  FROM bookings
  WHERE created_at >= CURRENT_DATE - (days || ' days')::interval
  GROUP BY DATE(created_at)
  ORDER BY date DESC;
END;
$$;

-- Fonction pour obtenir l'activité quotidienne combinée
CREATE OR REPLACE FUNCTION get_daily_activity(days integer DEFAULT 30)
RETURNS TABLE (
  date date,
  users bigint,
  listings bigint,
  bookings bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - (days || ' days')::interval,
      CURRENT_DATE,
      '1 day'::interval
    )::date as d
  ),
  user_counts AS (
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM profiles
    WHERE created_at >= CURRENT_DATE - (days || ' days')::interval
    GROUP BY DATE(created_at)
  ),
  listing_counts AS (
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM listings
    WHERE created_at >= CURRENT_DATE - (days || ' days')::interval
    GROUP BY DATE(created_at)
  ),
  booking_counts AS (
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM bookings
    WHERE created_at >= CURRENT_DATE - (days || ' days')::interval
    GROUP BY DATE(created_at)
  )
  SELECT 
    ds.d as date,
    COALESCE(uc.count, 0) as users,
    COALESCE(lc.count, 0) as listings,
    COALESCE(bc.count, 0) as bookings
  FROM date_series ds
  LEFT JOIN user_counts uc ON ds.d = uc.date
  LEFT JOIN listing_counts lc ON ds.d = lc.date
  LEFT JOIN booking_counts bc ON ds.d = bc.date
  ORDER BY ds.d DESC;
END;
$$;

-- Accorder les permissions d'exécution aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION get_daily_user_growth(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_listing_growth(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_booking_growth(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_activity(integer) TO authenticated;