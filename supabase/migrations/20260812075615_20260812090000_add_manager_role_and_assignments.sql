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
CREATE POLICY "Admins manage all assignments"
  ON manager_assignments FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Managers view own assignments"
  ON manager_assignments FOR SELECT TO authenticated
  USING (manager_id = auth.uid());

-- 4. Accès du manager aux données des logements attribués
CREATE POLICY "Managers view bookings of assigned listings"
  ON bookings FOR SELECT TO authenticated
  USING (is_assigned_manager(listing_id));

CREATE POLICY "Managers view leases of assigned listings"
  ON leases FOR SELECT TO authenticated
  USING (is_assigned_manager(listing_id));

CREATE POLICY "Managers update assigned listings"
  ON listings FOR UPDATE TO authenticated
  USING (can_manage_listing(id))
  WITH CHECK (can_manage_listing(id));
