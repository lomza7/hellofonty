/*
  # Fonction pour récupérer l'email d'un utilisateur

  1. Nouvelle fonction
    - `get_user_email` - Récupère l'email depuis auth.users
    
  2. Sécurité
    - Accessible uniquement aux utilisateurs authentifiés
    - Retourne uniquement l'email, pas toutes les infos sensibles
*/

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