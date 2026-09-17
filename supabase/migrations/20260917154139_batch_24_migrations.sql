/*
  Rôle "manager" + attribution de logements

  1. Ajoute le rôle 'manager' aux profils (admin = super-administrateur, inchangé)
  2. Table manager_assignments : quel manager peut voir/gérer quel logement
  3. Règles de sécurité (RLS) :
     - l'admin gère toutes les attributions
     - le manager voit ses propres attributions
     - le manager voit les réservations et baux des logements attribués
     - le manager avec permission 'manage' peut modifier le logement
*/

-- 1. Autoriser le rôle 'manager'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['student'::text, 'landlord'::text, 'admin'::text, 'manager'::text]));

-- 2. Table des attributions
CREATE TABLE IF NOT EXISTS manager_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  permission text NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'manage')),
  assigned_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (manager_id, listing_id)
);

ALTER TABLE manager_assignments ENABLE ROW LEVEL SECURITY;

-- Fonctions utilitaires (SECURITY DEFINER pour éviter la récursion RLS)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION is_assigned_manager(p_listing_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM manager_assignments
    WHERE manager_id = auth.uid() AND listing_id = p_listing_id
  );
$$;

CREATE OR REPLACE FUNCTION can_manage_listing(p_listing_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM manager_assignments
    WHERE manager_id = auth.uid() AND listing_id = p_listing_id AND permission = 'manage'
  );
$$;

-- 3. Politiques sur manager_assignments
DROP POLICY IF EXISTS "Admins manage all assignments" ON manager_assignments;
CREATE POLICY "Admins manage all assignments"
  ON manager_assignments FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Managers view own assignments" ON manager_assignments;
CREATE POLICY "Managers view own assignments"
  ON manager_assignments FOR SELECT TO authenticated
  USING (manager_id = auth.uid());

-- 4. Accès du manager aux données des logements attribués
DROP POLICY IF EXISTS "Managers view bookings of assigned listings" ON bookings;
CREATE POLICY "Managers view bookings of assigned listings"
  ON bookings FOR SELECT TO authenticated
  USING (is_assigned_manager(listing_id));

DROP POLICY IF EXISTS "Managers view leases of assigned listings" ON leases;
CREATE POLICY "Managers view leases of assigned listings"
  ON leases FOR SELECT TO authenticated
  USING (is_assigned_manager(listing_id));

DROP POLICY IF EXISTS "Managers update assigned listings" ON listings;
CREATE POLICY "Managers update assigned listings"
  ON listings FOR UPDATE TO authenticated
  USING (can_manage_listing(id))
  WITH CHECK (can_manage_listing(id));

/*
  Guide d'accès côté étudiant, déverrouillé 24 h avant l'arrivée
  + correctif de sécurité du partage par lien

  1. get_my_access_guide(booking_id) : ne renvoie le guide QUE si la réservation
     appartient à l'étudiant connecté, est confirmée, et que l'arrivée est dans
     moins de 24 h (contrôle côté serveur, pas seulement à l'affichage)
  2. SÉCURITÉ : supprime la politique publique trop large sur access_guides
     (elle laissait lire TOUS les guides — codes et wifi — à quiconque interroge la table)
     et la remplace par une fonction qui ne renvoie qu'UN guide contre son token exact.
*/

-- 1. Guide de l'étudiant, verrouillé jusqu'à H-24
CREATE OR REPLACE FUNCTION get_my_access_guide(p_booking_id uuid)
RETURNS TABLE (
  listing_id uuid,
  listing_title text,
  listing_address text,
  listing_city text,
  start_date date,
  unlocked boolean,
  access_type text,
  access_instructions text,
  wifi_ssid text,
  wifi_password text,
  parking_info text,
  access_photos text[],
  access_video text,
  additional_info text
) LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    l.id,
    l.title,
    l.address,
    l.city,
    b.start_date,
    (now() >= (b.start_date::timestamptz - interval '24 hours')) AS unlocked,
    CASE WHEN now() >= (b.start_date::timestamptz - interval '24 hours') THEN ag.access_type END,
    CASE WHEN now() >= (b.start_date::timestamptz - interval '24 hours') THEN ag.access_instructions END,
    CASE WHEN now() >= (b.start_date::timestamptz - interval '24 hours') THEN ag.wifi_ssid END,
    CASE WHEN now() >= (b.start_date::timestamptz - interval '24 hours') THEN ag.wifi_password END,
    CASE WHEN now() >= (b.start_date::timestamptz - interval '24 hours') THEN ag.parking_info END,
    CASE WHEN now() >= (b.start_date::timestamptz - interval '24 hours') THEN ag.access_photos END,
    CASE WHEN now() >= (b.start_date::timestamptz - interval '24 hours') THEN ag.access_video END,
    CASE WHEN now() >= (b.start_date::timestamptz - interval '24 hours') THEN ag.additional_info END
  FROM bookings b
  JOIN listings l ON l.id = b.listing_id
  LEFT JOIN access_guides ag ON ag.listing_id = b.listing_id
  WHERE b.id = p_booking_id
    AND b.student_id = auth.uid()
    AND b.status = 'confirmed'
    AND b.end_date >= CURRENT_DATE
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_my_access_guide(uuid) TO authenticated;

-- 2. Correctif sécurité du partage par token (le lien manuel du proprio)
DROP POLICY IF EXISTS "Anyone can view access guide with valid token" ON access_guides;

CREATE OR REPLACE FUNCTION get_access_guide_by_token(p_token text)
RETURNS TABLE (
  listing_id uuid,
  access_type text,
  access_instructions text,
  wifi_ssid text,
  wifi_password text,
  parking_info text,
  access_photos text[],
  access_video text,
  additional_info text
) LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT ag.listing_id, ag.access_type, ag.access_instructions, ag.wifi_ssid,
         ag.wifi_password, ag.parking_info, ag.access_photos, ag.access_video, ag.additional_info
  FROM access_guides ag
  WHERE ag.share_token = p_token AND ag.share_token IS NOT NULL
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_access_guide_by_token(text) TO anon, authenticated;
-- Revoke all privileges from anon role on access_guides
-- Public access is handled by the RPC function get_access_guide_by_token (SECURITY DEFINER)
REVOKE ALL ON public.access_guides FROM anon;

/*
# Ajout des dates de déverrouillage et d'expiration personnalisées pour les guides d'accès

## Contexte
Actuellement, le guide d'accès d'un logement se déverrouille automatiquement 24h avant
la date d'arrivée de l'étudiant (bookings.start_date). Cette logique est codée en dur
dans la fonction RPC get_my_access_guide. Quand un étudiant arrive en avance (ex: la
veille), le propriétaire ne peut pas lui donner accès au guide sans modifier le contrat.

## Changements

### 1. Nouvelles colonnes sur la table `access_guides`
- `unlock_date` (date, nullable) : date à laquelle le guide devient accessible à
  l'étudiant. Quand cette colonne est NULL, le comportement par défaut (24h avant
  start_date) s'applique. Quand elle est renseignée, elle remplace la règle par défaut.
- `valid_until_date` (date, nullable) : date après laquelle le guide n'est plus
  accessible. Quand cette colonne est NULL, le guide reste valide jusqu'à la fin du
  séjour (bookings.end_date), comme aujourd'hui.

### 2. Modification de la fonction `get_my_access_guide`
- La colonne `unlocked` utilise désormais `unlock_date` si elle est renseignée,
  sinon `start_date - 24h` (comportement par défaut inchangé).
- Les champs sensibles ne sont renvoyés que si `unlocked = true` ET si
  `valid_until_date` n'est pas dépassée (ou absente).
- Ajout de deux colonnes de retour : `unlock_date` et `valid_until_date` pour que
  le frontend puisse afficher les bonnes dates à l'étudiant.

## Sécurité
- Aucun changement de politique RLS. La fonction reste SECURITY DEFINER et vérifie
  déjà que l'étudiant est propriétaire de la réservation (b.student_id = auth.uid()).
- Les colonnes sont facultatives (nullable) pour ne pas casser les guides existants.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'access_guides' AND column_name = 'unlock_date'
  ) THEN
    ALTER TABLE access_guides ADD COLUMN unlock_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'access_guides' AND column_name = 'valid_until_date'
  ) THEN
    ALTER TABLE access_guides ADD COLUMN valid_until_date date;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.get_my_access_guide(uuid);

CREATE FUNCTION public.get_my_access_guide(p_booking_id uuid)
RETURNS TABLE(
  listing_id uuid,
  listing_title text,
  listing_address text,
  listing_city text,
  start_date date,
  unlocked boolean,
  access_type text,
  access_instructions text,
  wifi_ssid text,
  wifi_password text,
  parking_info text,
  access_photos text[],
  access_video text,
  additional_info text,
  unlock_date date,
  valid_until_date date
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
SELECT
  l.id,
  l.title,
  l.address,
  l.city,
  b.start_date,
  (
    now() >= COALESCE(
      ag.unlock_date::timestamptz,
      b.start_date::timestamptz - interval '24 hours'
    )
    AND (
      ag.valid_until_date IS NULL
      OR now() < ag.valid_until_date::timestamptz + interval '24 hours'
    )
  ) AS unlocked,
  CASE WHEN
    now() >= COALESCE(
      ag.unlock_date::timestamptz,
      b.start_date::timestamptz - interval '24 hours'
    )
    AND (
      ag.valid_until_date IS NULL
      OR now() < ag.valid_until_date::timestamptz + interval '24 hours'
    )
  THEN ag.access_type END,
  CASE WHEN
    now() >= COALESCE(
      ag.unlock_date::timestamptz,
      b.start_date::timestamptz - interval '24 hours'
    )
    AND (
      ag.valid_until_date IS NULL
      OR now() < ag.valid_until_date::timestamptz + interval '24 hours'
    )
  THEN ag.access_instructions END,
  CASE WHEN
    now() >= COALESCE(
      ag.unlock_date::timestamptz,
      b.start_date::timestamptz - interval '24 hours'
    )
    AND (
      ag.valid_until_date IS NULL
      OR now() < ag.valid_until_date::timestamptz + interval '24 hours'
    )
  THEN ag.wifi_ssid END,
  CASE WHEN
    now() >= COALESCE(
      ag.unlock_date::timestamptz,
      b.start_date::timestamptz - interval '24 hours'
    )
    AND (
      ag.valid_until_date IS NULL
      OR now() < ag.valid_until_date::timestamptz + interval '24 hours'
    )
  THEN ag.wifi_password END,
  CASE WHEN
    now() >= COALESCE(
      ag.unlock_date::timestamptz,
      b.start_date::timestamptz - interval '24 hours'
    )
    AND (
      ag.valid_until_date IS NULL
      OR now() < ag.valid_until_date::timestamptz + interval '24 hours'
    )
  THEN ag.parking_info END,
  CASE WHEN
    now() >= COALESCE(
      ag.unlock_date::timestamptz,
      b.start_date::timestamptz - interval '24 hours'
    )
    AND (
      ag.valid_until_date IS NULL
      OR now() < ag.valid_until_date::timestamptz + interval '24 hours'
    )
  THEN ag.access_photos END,
  CASE WHEN
    now() >= COALESCE(
      ag.unlock_date::timestamptz,
      b.start_date::timestamptz - interval '24 hours'
    )
    AND (
      ag.valid_until_date IS NULL
      OR now() < ag.valid_until_date::timestamptz + interval '24 hours'
    )
  THEN ag.access_video END,
  CASE WHEN
    now() >= COALESCE(
      ag.unlock_date::timestamptz,
      b.start_date::timestamptz - interval '24 hours'
    )
    AND (
      ag.valid_until_date IS NULL
      OR now() < ag.valid_until_date::timestamptz + interval '24 hours'
    )
  THEN ag.additional_info END,
  ag.unlock_date,
  ag.valid_until_date
FROM bookings b
JOIN listings l ON l.id = b.listing_id
LEFT JOIN access_guides ag ON ag.listing_id = b.listing_id
WHERE b.id = p_booking_id
  AND b.student_id = auth.uid()
  AND b.status = 'confirmed'
  AND b.end_date >= CURRENT_DATE
LIMIT 1;
$function$;
/*
  # Dates de déverrouillage par réservation

  ## Contexte
  Actuellement, les dates unlock_date et valid_until_date sont stockées au niveau du
  guide d'accès (access_guides), qui est unique par logement. Quand un logement a
  plusieurs réservations la même année, toutes partagent les mêmes dates.

  ## Changements

  ### 1. Nouvelle table `access_guide_unlock_overrides`
  - `id` (uuid, primary key)
  - `booking_id` (uuid, référence vers bookings, UNIQUE) — une ligne max par réservation
  - `unlock_date` (date, nullable) — date de déverrouillage spécifique à cette réservation
  - `valid_until_date` (date, nullable) — date d'expiration spécifique à cette réservation
  - `created_at` / `updated_at` (timestamptz)

  ### 2. Mise à jour de la fonction `get_my_access_guide`
  - Priorité des dates : override de la réservation > dates du guide (logement) > défaut (24h avant start_date)
  - Les colonnes unlock_date et valid_until_date retournées reflètent la source effective

  ### 3. Sécurité
  - RLS activée sur access_guide_unlock_overrides
  - Le propriétaire du logement peut lire/écrire les overrides pour les réservations de ses logements
  - L'étudiant n'y accède pas directement (la fonction SECURITY DEFINER filtre déjà par student_id)
*/

CREATE TABLE IF NOT EXISTS access_guide_unlock_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  unlock_date date,
  valid_until_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE access_guide_unlock_overrides ENABLE ROW LEVEL SECURITY;

-- Le propriétaire peut voir les overrides pour les réservations de ses logements
DROP POLICY IF EXISTS "Landlords can view unlock overrides" ON access_guide_unlock_overrides;
CREATE POLICY "Landlords can view unlock overrides"
  ON access_guide_unlock_overrides FOR SELECT
  TO authenticated
  USING (
    booking_id IN (
      SELECT b.id FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE l.landlord_id = auth.uid()
    )
  );

-- Le propriétaire peut créer des overrides pour les réservations de ses logements
DROP POLICY IF EXISTS "Landlords can insert unlock overrides" ON access_guide_unlock_overrides;
CREATE POLICY "Landlords can insert unlock overrides"
  ON access_guide_unlock_overrides FOR INSERT
  TO authenticated
  WITH CHECK (
    booking_id IN (
      SELECT b.id FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE l.landlord_id = auth.uid()
    )
  );

-- Le propriétaire peut modifier les overrides pour les réservations de ses logements
DROP POLICY IF EXISTS "Landlords can update unlock overrides" ON access_guide_unlock_overrides;
CREATE POLICY "Landlords can update unlock overrides"
  ON access_guide_unlock_overrides FOR UPDATE
  TO authenticated
  USING (
    booking_id IN (
      SELECT b.id FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE l.landlord_id = auth.uid()
    )
  )
  WITH CHECK (
    booking_id IN (
      SELECT b.id FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE l.landlord_id = auth.uid()
    )
  );

-- Le propriétaire peut supprimer les overrides pour les réservations de ses logements
DROP POLICY IF EXISTS "Landlords can delete unlock overrides" ON access_guide_unlock_overrides;
CREATE POLICY "Landlords can delete unlock overrides"
  ON access_guide_unlock_overrides FOR DELETE
  TO authenticated
  USING (
    booking_id IN (
      SELECT b.id FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE l.landlord_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_unlock_overrides_booking_id ON access_guide_unlock_overrides(booking_id);

-- Mise à jour de la fonction pour prendre en compte les overrides par réservation
DROP FUNCTION IF EXISTS public.get_my_access_guide(uuid);

CREATE FUNCTION public.get_my_access_guide(p_booking_id uuid)
RETURNS TABLE(
  listing_id uuid,
  listing_title text,
  listing_address text,
  listing_city text,
  start_date date,
  unlocked boolean,
  access_type text,
  access_instructions text,
  wifi_ssid text,
  wifi_password text,
  parking_info text,
  access_photos text[],
  access_video text,
  additional_info text,
  unlock_date date,
  valid_until_date date
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    l.id,
    l.title,
    l.address,
    l.city,
    b.start_date,
    (
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        ag.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        COALESCE(o.valid_until_date, ag.valid_until_date) IS NULL
        OR now() < COALESCE(o.valid_until_date, ag.valid_until_date)::timestamptz + interval '24 hours'
      )
    ) AS unlocked,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        ag.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        COALESCE(o.valid_until_date, ag.valid_until_date) IS NULL
        OR now() < COALESCE(o.valid_until_date, ag.valid_until_date)::timestamptz + interval '24 hours'
      )
    THEN ag.access_type END,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        ag.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        COALESCE(o.valid_until_date, ag.valid_until_date) IS NULL
        OR now() < COALESCE(o.valid_until_date, ag.valid_until_date)::timestamptz + interval '24 hours'
      )
    THEN ag.access_instructions END,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        ag.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        COALESCE(o.valid_until_date, ag.valid_until_date) IS NULL
        OR now() < COALESCE(o.valid_until_date, ag.valid_until_date)::timestamptz + interval '24 hours'
      )
    THEN ag.wifi_ssid END,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        ag.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        COALESCE(o.valid_until_date, ag.valid_until_date) IS NULL
        OR now() < COALESCE(o.valid_until_date, ag.valid_until_date)::timestamptz + interval '24 hours'
      )
    THEN ag.wifi_password END,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        ag.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        COALESCE(o.valid_until_date, ag.valid_until_date) IS NULL
        OR now() < COALESCE(o.valid_until_date, ag.valid_until_date)::timestamptz + interval '24 hours'
      )
    THEN ag.parking_info END,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        ag.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        COALESCE(o.valid_until_date, ag.valid_until_date) IS NULL
        OR now() < COALESCE(o.valid_until_date, ag.valid_until_date)::timestamptz + interval '24 hours'
      )
    THEN ag.access_photos END,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        ag.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        COALESCE(o.valid_until_date, ag.valid_until_date) IS NULL
        OR now() < COALESCE(o.valid_until_date, ag.valid_until_date)::timestamptz + interval '24 hours'
      )
    THEN ag.access_video END,
    CASE WHEN
      now() >= COALESCE(
        o.unlock_date::timestamptz,
        ag.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        COALESCE(o.valid_until_date, ag.valid_until_date) IS NULL
        OR now() < COALESCE(o.valid_until_date, ag.valid_until_date)::timestamptz + interval '24 hours'
      )
    THEN ag.additional_info END,
    COALESCE(o.unlock_date, ag.unlock_date),
    COALESCE(o.valid_until_date, ag.valid_until_date)
  FROM bookings b
  JOIN listings l ON l.id = b.listing_id
  LEFT JOIN access_guides ag ON ag.listing_id = b.listing_id
  LEFT JOIN access_guide_unlock_overrides o ON o.booking_id = b.id
  WHERE b.id = p_booking_id
    AND b.student_id = auth.uid()
    AND b.status = 'confirmed'
    AND b.end_date >= CURRENT_DATE
  LIMIT 1;
$function$;