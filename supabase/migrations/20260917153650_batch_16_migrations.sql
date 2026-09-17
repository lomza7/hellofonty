-- Admin Subscription Access and Stripe Integration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pricing_plans' AND column_name = 'stripe_price_id'
  ) THEN
    ALTER TABLE pricing_plans ADD COLUMN stripe_price_id text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pricing_plans' AND column_name = 'stripe_product_id'
  ) THEN
    ALTER TABLE pricing_plans ADD COLUMN stripe_product_id text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pricing_plans_stripe_price_id ON pricing_plans(stripe_price_id);
CREATE INDEX IF NOT EXISTS idx_pricing_plans_stripe_product_id ON pricing_plans(stripe_product_id);

DO $$
BEGIN
  DROP POLICY IF EXISTS "Admin can view all subscriptions" ON subscriptions;
  DROP POLICY IF EXISTS "Admin can update all subscriptions" ON subscriptions;
  DROP POLICY IF EXISTS "Admin can insert invoices" ON invoices;
  DROP POLICY IF EXISTS "Admin can view all stripe customers" ON stripe_customers;
  DROP POLICY IF EXISTS "Admin can view all stripe subscriptions" ON stripe_subscriptions;
END $$;

CREATE POLICY "Admin can view all subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin can update all subscriptions"
  ON subscriptions FOR UPDATE
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

CREATE POLICY "Admin can insert invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin can view all stripe customers"
  ON stripe_customers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin can view all stripe subscriptions"
  ON stripe_subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE OR REPLACE VIEW admin_subscription_overview AS
SELECT 
  p.id as user_id,
  p.first_name,
  p.last_name,
  p.role,
  s.plan_type,
  s.status as subscription_status,
  s.current_period_start,
  s.current_period_end,
  s.cancel_at_period_end,
  s.stripe_customer_id,
  s.stripe_subscription_id,
  s.stripe_price_id,
  s.created_at as subscription_created_at,
  s.updated_at as subscription_updated_at
FROM profiles p
LEFT JOIN subscriptions s ON p.id = s.user_id
WHERE p.role = 'landlord'
ORDER BY s.created_at DESC;

GRANT SELECT ON admin_subscription_overview TO authenticated;

CREATE OR REPLACE FUNCTION calculate_mrr()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_mrr numeric := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin only.';
  END IF;

  SELECT COALESCE(SUM(pp.price::numeric), 0)
  INTO total_mrr
  FROM subscriptions s
  JOIN pricing_plans pp ON s.stripe_price_id = pp.stripe_price_id
  WHERE s.status IN ('active', 'trialing')
  AND s.plan_type != 'free'
  AND pp.is_active = true;

  RETURN total_mrr;
END;
$$;

-- Système de gestion des tâches
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'important', 'normal')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'snoozed')),
  task_type text NOT NULL DEFAULT 'custom' CHECK (task_type IN ('system', 'custom')),
  related_entity_type text CHECK (related_entity_type IN ('booking', 'message', 'listing', 'document', 'payment', 'lease', 'inventory')),
  related_entity_id uuid,
  due_date timestamptz,
  snoozed_until timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_related_entity ON tasks(related_entity_type, related_entity_id);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
CREATE POLICY "Users can view own tasks"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own tasks" ON tasks;
CREATE POLICY "Users can create own tasks"
  ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tasks" ON tasks;
CREATE POLICY "Users can update own tasks"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tasks" ON tasks;
CREATE POLICY "Users can delete own tasks"
  ON tasks
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all tasks" ON tasks;
CREATE POLICY "Admins can view all tasks"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE tasks;

-- Ajout du type d'entité 'profile' aux tâches
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_related_entity_type_check;

ALTER TABLE tasks ADD CONSTRAINT tasks_related_entity_type_check 
  CHECK (related_entity_type IN ('booking', 'message', 'listing', 'document', 'payment', 'lease', 'inventory', 'profile'));

-- Système de génération automatique des tâches de vérification de profil
CREATE OR REPLACE FUNCTION generate_profile_verification_tasks(profile_id uuid, user_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = profile_id AND avatar_url IS NOT NULL AND avatar_url != ''
  ) INTO task_exists;

  IF NOT task_exists THEN
    IF NOT EXISTS (
      SELECT 1 FROM tasks
      WHERE user_id = profile_id
      AND title = 'Ajouter une photo de profil'
      AND status IN ('pending', 'completed')
    ) THEN
      INSERT INTO tasks (
        user_id,
        title,
        description,
        priority,
        status,
        task_type,
        related_entity_type
      ) VALUES (
        profile_id,
        'Ajouter une photo de profil',
        'Ajoutez une photo de profil pour compléter votre vérification. Rendez-vous dans votre profil.',
        'important',
        'pending',
        'system',
        'profile'
      );
    END IF;
  END IF;

  IF user_role = 'landlord' THEN
    SELECT EXISTS (
      SELECT 1 FROM landlord_documents
      WHERE landlord_id = profile_id
      AND document_type = 'id_card'
      AND status = 'approved'
    ) INTO task_exists;

    IF NOT task_exists THEN
      IF NOT EXISTS (
        SELECT 1 FROM tasks
        WHERE user_id = profile_id
        AND title = 'Télécharger votre justificatif d''identité'
        AND status IN ('pending', 'completed')
      ) THEN
        INSERT INTO tasks (
          user_id,
          title,
          description,
          priority,
          status,
          task_type,
          related_entity_type
        ) VALUES (
          profile_id,
          'Télécharger votre justificatif d''identité',
          'Téléchargez votre pièce d''identité dans vos documents pour compléter votre vérification.',
          'important',
          'pending',
          'system',
          'document'
        );
      END IF;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM landlord_documents
      WHERE landlord_id = profile_id
      AND document_type = 'property_tax'
      AND status = 'approved'
    ) INTO task_exists;

    IF NOT task_exists THEN
      IF NOT EXISTS (
        SELECT 1 FROM tasks
        WHERE user_id = profile_id
        AND title = 'Télécharger votre taxe foncière'
        AND status IN ('pending', 'completed')
      ) THEN
        INSERT INTO tasks (
          user_id,
          title,
          description,
          priority,
          status,
          task_type,
          related_entity_type
        ) VALUES (
          profile_id,
          'Télécharger votre taxe foncière',
          'Téléchargez votre justificatif de propriété (taxe foncière) dans vos documents.',
          'important',
          'pending',
          'system',
          'document'
        );
      END IF;
    END IF;
  END IF;

  IF user_role = 'student' THEN
    SELECT EXISTS (
      SELECT 1 FROM student_documents
      WHERE student_id = profile_id
      AND document_type = 'accommodation_certificate'
      AND status = 'approved'
    ) INTO task_exists;

    IF NOT task_exists THEN
      IF NOT EXISTS (
        SELECT 1 FROM tasks
        WHERE user_id = profile_id
        AND title = 'Télécharger votre attestation INSEAD'
        AND status IN ('pending', 'completed')
      ) THEN
        INSERT INTO tasks (
          user_id,
          title,
          description,
          priority,
          status,
          task_type,
          related_entity_type
        ) VALUES (
          profile_id,
          'Télécharger votre attestation INSEAD',
          'Téléchargez votre attestation INSEAD dans vos documents pour compléter votre vérification.',
          'important',
          'pending',
          'system',
          'document'
        );
      END IF;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_generate_profile_verification_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM generate_profile_verification_tasks(NEW.id, NEW.role);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_profile_insert_generate_tasks ON profiles;
CREATE TRIGGER after_profile_insert_generate_tasks
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_profile_verification_tasks();

CREATE OR REPLACE FUNCTION complete_profile_photo_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.avatar_url IS NOT NULL AND NEW.avatar_url != '' THEN
    UPDATE tasks
    SET
      status = 'completed',
      completed_at = now()
    WHERE
      user_id = NEW.id
      AND title = 'Ajouter une photo de profil'
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_profile_photo_update ON profiles;
CREATE TRIGGER after_profile_photo_update
  AFTER UPDATE OF avatar_url ON profiles
  FOR EACH ROW
  WHEN (NEW.avatar_url IS DISTINCT FROM OLD.avatar_url)
  EXECUTE FUNCTION complete_profile_photo_task();

CREATE OR REPLACE FUNCTION complete_landlord_document_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_title text;
BEGIN
  IF NEW.document_type = 'id_card' THEN
    task_title := 'Télécharger votre justificatif d''identité';
  ELSIF NEW.document_type = 'property_tax' THEN
    task_title := 'Télécharger votre taxe foncière';
  END IF;

  IF task_title IS NOT NULL THEN
    UPDATE tasks
    SET
      status = 'completed',
      completed_at = now()
    WHERE
      user_id = NEW.landlord_id
      AND title = task_title
      AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_landlord_document_insert ON landlord_documents;
CREATE TRIGGER after_landlord_document_insert
  AFTER INSERT ON landlord_documents
  FOR EACH ROW
  EXECUTE FUNCTION complete_landlord_document_task();

CREATE OR REPLACE FUNCTION complete_student_document_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.document_type = 'accommodation_certificate' THEN
    UPDATE tasks
    SET
      status = 'completed',
      completed_at = now()
    WHERE
      user_id = NEW.student_id
      AND title = 'Télécharger votre attestation INSEAD'
      AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_student_document_insert ON student_documents;
CREATE TRIGGER after_student_document_insert
  AFTER INSERT ON student_documents
  FOR EACH ROW
  EXECUTE FUNCTION complete_student_document_task();

DO $$
DECLARE
  profile_record RECORD;
BEGIN
  FOR profile_record IN
    SELECT id, role FROM profiles
    WHERE role IN ('landlord', 'student')
  LOOP
    PERFORM generate_profile_verification_tasks(profile_record.id, profile_record.role);
  END LOOP;
END $$;

-- Système d'offres partenaires
CREATE TABLE IF NOT EXISTS partner_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  company_name text NOT NULL,
  image_url text,
  cta_text text NOT NULL DEFAULT 'En savoir plus',
  cta_link text NOT NULL,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  verified boolean DEFAULT true,
  target_audience text DEFAULT 'both' CHECK (target_audience IN ('landlord', 'student', 'both')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE partner_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view active partner offers" ON partner_offers;
CREATE POLICY "Authenticated users can view active partner offers"
  ON partner_offers
  FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can view all partner offers" ON partner_offers;
CREATE POLICY "Admins can view all partner offers"
  ON partner_offers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert partner offers" ON partner_offers;
CREATE POLICY "Admins can insert partner offers"
  ON partner_offers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update partner offers" ON partner_offers;
CREATE POLICY "Admins can update partner offers"
  ON partner_offers
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

DROP POLICY IF EXISTS "Admins can delete partner offers" ON partner_offers;
CREATE POLICY "Admins can delete partner offers"
  ON partner_offers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_partner_offers_active ON partner_offers(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_partner_offers_target ON partner_offers(target_audience, is_active);

CREATE OR REPLACE FUNCTION update_partner_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS partner_offers_updated_at ON partner_offers;
CREATE TRIGGER partner_offers_updated_at
  BEFORE UPDATE ON partner_offers
  FOR EACH ROW
  EXECUTE FUNCTION update_partner_offers_updated_at();

INSERT INTO partner_offers (title, description, company_name, cta_text, cta_link, display_order, target_audience) VALUES
('Assurance habitation en ligne', 'Protégez votre logement avec une assurance 100% digitale. Souscription en 3 minutes, résiliation à tout moment.', 'QOVER', 'Obtenir un devis', 'https://www.qover.com', 1, 'landlord'),
('Place gratuite - Concert de Jazz', 'Gagnez une place gratuite pour le prochain concert de Jazz à Fontainebleau. Offre exclusive pour nos utilisateurs.', 'Jazz à Fontainebleau', 'Réserver ma place', '#', 2, 'both'),
('Crédit étudiant avantageux', 'Financez vos études avec des taux préférentiels. Sans frais de dossier pour les étudiants INSEAD.', 'BNP Paribas', 'Simuler mon prêt', '#', 3, 'student')
ON CONFLICT DO NOTHING;
