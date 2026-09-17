/*
# Add max_stay_months column to listings

## Description
Ajoute une colonne `max_stay_months` a la table `listings` pour permettre
de definir la duree maximum de sejour autorisee pour chaque annonce.
La valeur par defaut est 6 mois.

## Nouvelle colonne
- `max_stay_months` (numeric, default 6) - Duree maximum de sejour en mois

## Notes
- La colonne est nullable pour compatibilite avec les annonces existantes.
- Les annonces existantes auront la valeur par defaut de 6 mois appliquee automatiquement.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'max_stay_months'
  ) THEN
    ALTER TABLE listings ADD COLUMN max_stay_months numeric DEFAULT 6;
  END IF;
END $$;
/*
# Replace accommodation certificate with home insurance as required student document

1. Context
   - Previously, students were required to upload an "attestation d'hébergement" (accommodation_certificate)
     as a mandatory document. Following user feedback, this is no longer required.
   - The home insurance certificate (insurance_certificate) becomes the mandatory document instead.
   - The accommodation_certificate remains available as an optional/complementary document.

2. Changes to `generate_profile_verification_tasks`
   - The function now checks whether the student has an approved `insurance_certificate`
     (instead of `accommodation_certificate`) to decide whether to create the verification task.
   - The task title changes from "Télécharger votre attestation INSEAD" to
     "Télécharger votre assurance habitation" with an updated description.

3. Changes to `complete_student_document_task`
   - The trigger now completes the task "Télécharger votre assurance habitation" when an
     `insurance_certificate` is uploaded (instead of completing the INSEAD attestation task
     on `accommodation_certificate` upload).
   - The `insead_attestation` document type is preserved and still completes the
     "Télécharger votre attestation INSEAD" task if one exists.

4. Data migration
   - Existing pending tasks titled "Télécharger votre attestation INSEAD" that were tied to
     the accommodation_certificate flow are renamed to "Télécharger votre assurance habitation"
     so students see the correct task on their dashboard.

5. Security
   - No RLS policy changes. All functions remain SECURITY DEFINER as before.
   - No new tables or columns are created.
*/

-- 1. Update generate_profile_verification_tasks: check insurance_certificate instead of accommodation_certificate
CREATE OR REPLACE FUNCTION generate_profile_verification_tasks(profile_id uuid, user_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_exists boolean;
BEGIN
  -- Tâches communes à tous les utilisateurs
  IF user_role IN ('landlord', 'student', 'manager') THEN
    -- Tâche photo de profil
    SELECT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = profile_id
      AND avatar_url IS NOT NULL
      AND avatar_url != ''
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
          'Ajoutez une photo de profil pour personnaliser votre compte et rassurer les autres utilisateurs.',
          'normal',
          'pending',
          'system',
          'profile'
        );
      END IF;
    END IF;
  END IF;

  -- Tâches spécifiques pour les propriétaires
  IF user_role = 'landlord' THEN
    -- Tâche justificatif d'identité
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
          'Téléchargez une copie de votre pièce d''identité dans vos documents propriétaire.',
          'important',
          'pending',
          'system',
          'document'
        );
      END IF;
    END IF;

    -- Tâche taxe foncière
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

  -- Tâches spécifiques pour les étudiants
  IF user_role = 'student' THEN
    -- Tâche assurance habitation (remplace l'attestation d'hébergement)
    SELECT EXISTS (
      SELECT 1 FROM student_documents
      WHERE student_id = profile_id
      AND document_type = 'insurance_certificate'
      AND status = 'approved'
    ) INTO task_exists;

    IF NOT task_exists THEN
      IF NOT EXISTS (
        SELECT 1 FROM tasks
        WHERE user_id = profile_id
        AND title = 'Télécharger votre assurance habitation'
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
          'Télécharger votre assurance habitation',
          'Téléchargez votre attestation d''assurance habitation dans vos documents pour compléter votre vérification.',
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

-- 2. Update complete_student_document_task: complete insurance task on insurance_certificate upload
CREATE OR REPLACE FUNCTION complete_student_document_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Complete the home insurance task when insurance_certificate is uploaded
  IF NEW.document_type = 'insurance_certificate' THEN
    UPDATE tasks
    SET
      status = 'completed',
      completed_at = now()
    WHERE
      user_id = NEW.student_id
      AND title = 'Télécharger votre assurance habitation'
      AND status = 'pending';
  END IF;

  -- Keep handling insead_attestation for the INSEAD attestation task
  IF NEW.document_type = 'insead_attestation' THEN
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

-- Re-create the trigger (drop old, create new) to ensure it fires on INSERT and UPDATE
DROP TRIGGER IF EXISTS after_student_document_insert ON student_documents;
DROP TRIGGER IF EXISTS after_student_document_change ON student_documents;
CREATE TRIGGER after_student_document_change
  AFTER INSERT OR UPDATE ON student_documents
  FOR EACH ROW
  EXECUTE FUNCTION complete_student_document_task();

-- 3. Rename existing pending tasks from the old INSEAD attestation title to the new insurance title
--    so current students see the correct task on their dashboard.
UPDATE tasks
SET
  title = 'Télécharger votre assurance habitation',
  description = 'Téléchargez votre attestation d''assurance habitation dans vos documents pour compléter votre vérification.'
WHERE
  title = 'Télécharger votre attestation INSEAD'
  AND status = 'pending'
  AND user_id IN (SELECT id FROM profiles WHERE role = 'student');

-- 4. Regenerate verification tasks for all existing students to ensure the new task exists
DO $$
DECLARE
  profile_record RECORD;
BEGIN
  FOR profile_record IN
    SELECT id, role FROM profiles
    WHERE role = 'student'
  LOOP
    PERFORM generate_profile_verification_tasks(profile_record.id, profile_record.role);
  END LOOP;
END $$;

/*
# Système de relance des loyers

1. Nouveaux champs sur `rent_payments`
   - `last_reminder_sent_at` (timestamptz, nullable) : date de la dernière relance envoyée, pour éviter les doublons.
   - `auto_reminder_enabled` (boolean, default true) : permet d'activer/désactiver la relance automatique par loyer individuel. Modifiable par l'admin et par le manager du logement concerné.

2. Nouvelle table `rent_reminder_settings`
   - Table de configuration globale (une seule ligne) avec un champ `auto_reminder_enabled` (boolean, default true) contrôlant la relance automatique pour toute la plateforme.
   - RLS : admin peut tout faire, les autres peuvent lire.

3. Nouveaux types de notifications
   - Ajout de `rent_reminder` et `rent_overdue` à la contrainte `notifications_type_check`.

4. Sécurité (RLS)
   - `bookings` : ajout d'une policy SELECT pour les admins (managers ont déjà la leur via `is_assigned_manager`).
   - `rent_payments` : ajout d'une policy SELECT pour les managers des logements concernés, et d'une policy UPDATE pour les admins (pour mettre à jour `auto_reminder_enabled`, `last_reminder_sent_at`, `status`).

5. Cron job quotidien
   - Programme un job `pg_cron` à 8h00 chaque jour qui appelle l'edge function `send-rent-reminder` via `pg_net`.
*/

-- 1. Nouveaux champs sur rent_payments
ALTER TABLE rent_payments ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz;
ALTER TABLE rent_payments ADD COLUMN IF NOT EXISTS auto_reminder_enabled boolean NOT NULL DEFAULT true;

-- 2. Table de configuration globale
CREATE TABLE IF NOT EXISTS rent_reminder_settings (
  id integer PRIMARY KEY DEFAULT 1,
  auto_reminder_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE rent_reminder_settings ENABLE ROW LEVEL SECURITY;

-- Insérer la ligne par défaut
INSERT INTO rent_reminder_settings (id, auto_reminder_enabled)
VALUES (1, true)
ON CONFLICT (id) DO NOTHING;

-- Policies pour rent_reminder_settings
DROP POLICY IF EXISTS "Admins manage rent reminder settings" ON rent_reminder_settings;
CREATE POLICY "Admins manage rent reminder settings"
  ON rent_reminder_settings FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS "Managers can read rent reminder settings" ON rent_reminder_settings;
CREATE POLICY "Managers can read rent reminder settings"
  ON rent_reminder_settings FOR SELECT
  TO authenticated
  USING (true);

-- 3. Ajout des types de notifications
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY['message', 'booking_request', 'booking_confirmed', 'booking_cancelled', 'lease_signature_request', 'lease_signed', 'deposit_refund', 'rent_reminder', 'rent_overdue'])
);

-- 4. Policies

-- bookings : admin SELECT
DROP POLICY IF EXISTS "Admins can view all bookings" ON bookings;
CREATE POLICY "Admins can view all bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- rent_payments : manager SELECT (via is_assigned_manager sur le listing du booking)
DROP POLICY IF EXISTS "Managers can view rent payments for assigned listings" ON rent_payments;
CREATE POLICY "Managers can view rent payments for assigned listings"
  ON rent_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN manager_assignments ma ON ma.listing_id = b.listing_id
      WHERE b.id = rent_payments.booking_id
      AND ma.manager_id = auth.uid()
    )
  );

-- rent_payments : admin UPDATE (pour auto_reminder_enabled, last_reminder_sent_at, status)
DROP POLICY IF EXISTS "Admins can update rent payments" ON rent_payments;
CREATE POLICY "Admins can update rent payments"
  ON rent_payments FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- rent_payments : manager UPDATE (pour auto_reminder_enabled et last_reminder_sent_at)
DROP POLICY IF EXISTS "Managers can update rent payments for assigned listings" ON rent_payments;
CREATE POLICY "Managers can update rent payments for assigned listings"
  ON rent_payments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN manager_assignments ma ON ma.listing_id = b.listing_id
      WHERE b.id = rent_payments.booking_id
      AND ma.manager_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings b
      JOIN manager_assignments ma ON ma.listing_id = b.listing_id
      WHERE b.id = rent_payments.booking_id
      AND ma.manager_id = auth.uid()
    )
  );

-- Index pour les relances
CREATE INDEX IF NOT EXISTS idx_rent_payments_reminder ON rent_payments(status, payment_date) WHERE status = 'pending';

-- 5. Cron job quotidien à 8h00
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('send-rent-reminder-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-rent-reminder-daily');

SELECT cron.schedule(
  'send-rent-reminder-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-rent-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

/*
# Relance automatique par réservation

1. Nouveau champ sur `bookings`
   - `auto_reminder_enabled` (boolean, default true) : permet d'activer/désactiver la relance automatique pour toute une réservation. Modifiable par l'admin et le manager du logement.

2. Sécurité (RLS)
   - `bookings` : ajout d'une policy UPDATE pour les admins (ils peuvent déjà SELECT).
   - `bookings` : ajout d'une policy UPDATE pour les managers des logements concernés (via `can_manage_listing`).
*/

-- 1. Nouveau champ sur bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS auto_reminder_enabled boolean NOT NULL DEFAULT true;

-- 2. Policies

-- bookings : admin UPDATE
DROP POLICY IF EXISTS "Admins can update bookings" ON bookings;
CREATE POLICY "Admins can update bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- bookings : manager UPDATE (via can_manage_listing)
DROP POLICY IF EXISTS "Managers can update bookings of assigned listings" ON bookings;
CREATE POLICY "Managers can update bookings of assigned listings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (can_manage_listing(listing_id))
  WITH CHECK (can_manage_listing(listing_id));

/*
# Contrat bilingue FR/EN + limite 8 mois + suppression loi 89/ALUR

## 1. Bilinguisme des templates de contrat
- Ajout colonne `language` (text, default 'fr') sur `contract_template_sections`
- Mise à jour des sections FR existantes (suppression loi 89, ALUR, bail mobilité, préavis, résiliation à tout moment, révision IRL, décès)
- Duplication de toutes les sections en anglais (language = 'en')
- Ajout clause de prévalence du français dans section "final" des deux versions
- Contrainte d'unicité sur (section_key, language)

## 2. Limite de durée 8 mois côté serveur
- Fonction `validate_booking_duration()` qui vérifie que start_date -> end_date < 8 mois
- Trigger `BEFORE INSERT` sur bookings pour bloquer les réservations > 8 mois
- Trigger `BEFORE UPDATE` sur leases pour bloquer les modifications de bail > 8 mois
- Vérification du cumul par locataire sur le même logement

## 3. Sécurité
- Aucune modification RLS (les policies existantes restent inchangées)
- Les triggers sont SECURITY DEFINER pour pouvoir lire les bookings existants

## Notes importantes
1. La limite de 8 mois est calculée en jours (240 jours ≈ 8 mois)
2. Le cumul vérifie toutes les bookings confirmées/non-annulées du même student_id + listing_id
3. Les sections EN sont des traductions fidèles des sections FR
*/

-- ============================================================
-- 1. AJOUT COLONNE LANGUAGE
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_template_sections' AND column_name = 'language'
  ) THEN
    ALTER TABLE contract_template_sections ADD COLUMN language text NOT NULL DEFAULT 'fr';
  END IF;
END $$;

-- Supprimer l'ancienne contrainte unique sur section_key seul
ALTER TABLE contract_template_sections DROP CONSTRAINT IF EXISTS contract_template_sections_section_key_key;

-- Nouvelle contrainte unique sur (section_key, language)
CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_template_section_key_lang
  ON contract_template_sections (section_key, language);

-- ============================================================
-- 2. MISE À JOUR DES SECTIONS FR EXISTANTES
-- ============================================================

-- HEADER (FR)
UPDATE contract_template_sections SET content =
'<h1>Contrat de location meublée à durée déterminée</h1>
<div class="subtitle">Logement ne constituant pas la résidence principale du locataire, régi par le Code civil</div>'
WHERE section_key = 'header' AND language = 'fr';

-- PARTIES (FR)
UPDATE contract_template_sections SET content =
'<h2>I. Désignation des parties</h2>

<h3>Le Bailleur</h3>
<p><strong>Nom et Prénom :</strong> {{landlord_name}}</p>
<p><strong>Adresse :</strong> {{landlord_address}}</p>
<p><strong>E-mail :</strong> {{landlord_email}}</p>
<p><strong>Qualité :</strong> Personne physique</p>
<p><em>Ci-après désigné « Le Bailleur »</em></p>

<h3>Le Locataire</h3>
<p><strong>Nom et Prénom :</strong> {{tenant_name}}</p>
{{tenant_phone}}
<p><strong>E-mail :</strong> {{tenant_email}}</p>
<p><strong>Domicile principal conservé :</strong> {{tenant_permanent_address}}</p>
<p style="margin-top: 10px; font-style: italic;">Je déclare que le logement ne constituera pas ma résidence principale et que je conserve mon domicile principal à l''adresse ci-dessus.</p>
<p><em>Ci-après désigné « Le Locataire »</em></p>'
WHERE section_key = 'parties' AND language = 'fr';

-- OBJECT (FR)
UPDATE contract_template_sections SET content =
'<h2>II. Objet du contrat</h2>
<p>Le présent contrat a pour objet la location d''un logement meublé ainsi déterminé :</p>
<h3>A. Consistance du logement</h3>
<p><strong>Adresse :</strong> {{listing_address}}</p>
<p><strong>Type d''habitat :</strong> Logement meublé</p>
<p><strong>Description :</strong> {{listing_title}}</p>
<h3>B. Destination des locaux</h3>
<p>Le logement est destiné exclusivement à l''usage d''habitation du locataire, à l''exclusion de tout usage commercial ou professionnel. Il est loué meublé et ne constitue pas la résidence principale du locataire.</p>'
WHERE section_key = 'object' AND language = 'fr';

-- DURATION (FR)
UPDATE contract_template_sections SET content =
'<h2>III. Date de prise d''effet et durée du contrat</h2>
<p><strong>Date de prise d''effet :</strong> {{start_date}}</p>
<p><strong>Date de fin prévue :</strong> {{end_date}}</p>
<p><strong>Durée du contrat :</strong> {{duration_months}} mois</p>
<p>Le présent contrat est conclu pour une durée ferme. Il prend fin automatiquement à la date prévue, sans qu''il soit nécessaire pour le bailleur de délivrer un congé. Aucune reconduction tacite n''est prévue.</p>
<p>La durée du séjour est toujours inférieure à 8 mois.</p>'
WHERE section_key = 'duration' AND language = 'fr';

-- FINANCIAL (FR)
UPDATE contract_template_sections SET content =
'<h2>IV. Conditions financières</h2>
<p><strong>Loyer mensuel (hors charges) :</strong> {{monthly_rent}} EUR</p>
<p><strong>Forfait de charges (définitif, sans régularisation) :</strong> {{charges}} EUR</p>
<p><strong>Total mensuel (loyer + charges) :</strong> {{total_monthly}} EUR</p>
<p><strong>Dépôt de garantie :</strong> {{security_deposit}} EUR</p>

<h3>A. Fixation du loyer</h3>
<p>Le loyer mensuel est fixé à {{monthly_rent}} EUR pour toute la durée du contrat. Aucune révision n''est applicable.</p>

<h3>B. Forfait de charges</h3>
<p>Le montant des charges est fixé forfaitairement et définitivement à {{charges}} EUR par mois. Il ne fera l''objet d''aucune régularisation ultérieure.</p>

<h3>C. Modalités de paiement</h3>
<p>Le paiement du loyer et des charges s''effectue via la plateforme HelloFonty. Les loyers sont payables mensuellement et d''avance. Un prorata s''applique si le séjour commence ou se termine en cours de mois, calculé sur la base du nombre de jours de présence.</p>

<h3>D. Dépôt de garantie</h3>
<p>{{deposit_clause}}</p>'
WHERE section_key = 'financial' AND language = 'fr';

-- TERMINATION (FR)
UPDATE contract_template_sections SET content =
'<h2>VIII. Résiliation du contrat</h2>
<p>Aucune résiliation anticipée n''est possible sauf accord écrit du bailleur. En cas de départ accepté par le bailleur, le locataire reste redevable des loyers et charges jusqu''au terme du contrat, sauf si le logement est reloué à un autre locataire pour une période chevauchant la période restant à courir.</p>'
WHERE section_key = 'termination' AND language = 'fr';

-- FINAL (FR) - ajout clause de prévalence
UPDATE contract_template_sections SET content =
'<h2>XI. Dispositions finales</h2>
<p>Les parties déclarent avoir pris connaissance et accepté les termes du présent contrat ainsi que des dispositions légales et réglementaires applicables.</p>
<p>Toute modification du présent contrat devra faire l''objet d''un avenant signé par les deux parties.</p>
<p>En cas de litige, les parties s''efforceront de trouver une solution amiable avant toute action judiciaire. À défaut, les tribunaux français seront seuls compétents.</p>
<p style="margin-top: 15px;"><strong>Le présent contrat est rédigé en français et en anglais ; en cas de divergence, la version française prévaut.</strong></p>'
WHERE section_key = 'final' AND language = 'fr';

-- ANNEXES (FR)
UPDATE contract_template_sections SET content =
'<h2>Annexes à joindre au contrat</h2>
<p>Les documents suivants doivent être annexés au présent contrat :</p>
<ul>
<li>État des lieux d''entrée détaillé</li>
<li>Inventaire du mobilier et des équipements</li>
<li>Attestation d''assurance habitation du locataire</li>
<li>Attestation de scolarité (établissement et période)</li>
</ul>'
WHERE section_key = 'annexes' AND language = 'fr';

-- ============================================================
-- 3. CRÉATION DES SECTIONS ANGLAISES
-- ============================================================

INSERT INTO contract_template_sections (section_key, title, content, display_order, is_active, is_editable, language) VALUES

('header', 'Contract header', '<h1>Furnished lease agreement for a fixed term</h1>
<div class="subtitle">Property not constituting the tenant''s principal residence, governed by the French Civil Code</div>', 1, true, true, 'en'),

('parties', 'Identification of parties', '<h2>I. Identification of parties</h2>

<h3>The Lessor</h3>
<p><strong>Name:</strong> {{landlord_name}}</p>
<p><strong>Address:</strong> {{landlord_address}}</p>
<p><strong>Email:</strong> {{landlord_email}}</p>
<p><strong>Status:</strong> Natural person</p>
<p><em>Hereinafter referred to as "The Lessor"</em></p>

<h3>The Tenant</h3>
<p><strong>Name:</strong> {{tenant_name}}</p>
{{tenant_phone}}
<p><strong>Email:</strong> {{tenant_email}}</p>
<p><strong>Principal residence retained:</strong> {{tenant_permanent_address}}</p>
<p style="margin-top: 10px; font-style: italic;">I declare that the accommodation will not constitute my principal residence and that I maintain my principal residence at the address above.</p>
<p><em>Hereinafter referred to as "The Tenant"</em></p>', 2, true, true, 'en'),

('object', 'Purpose of the contract', '<h2>II. Purpose of the contract</h2>
<p>This contract concerns the rental of a furnished property as follows:</p>
<h3>A. Description of the property</h3>
<p><strong>Address:</strong> {{listing_address}}</p>
<p><strong>Type:</strong> Furnished accommodation</p>
<p><strong>Description:</strong> {{listing_title}}</p>
<h3>B. Use of the premises</h3>
<p>The property is intended exclusively for the tenant''s residential use, excluding any commercial or professional use. It is rented furnished and does not constitute the tenant''s principal residence.</p>', 3, true, true, 'en'),

('duration', 'Effective date and duration', '<h2>III. Effective date and duration of the contract</h2>
<p><strong>Effective date:</strong> {{start_date}}</p>
<p><strong>End date:</strong> {{end_date}}</p>
<p><strong>Contract duration:</strong> {{duration_months}} months</p>
<p>This contract is concluded for a fixed term. It ends automatically on the scheduled date, without the lessor needing to give notice. No tacit renewal is provided.</p>
<p>The duration of the stay is always less than 8 months.</p>', 4, true, true, 'en'),

('financial', 'Financial conditions', '<h2>IV. Financial conditions</h2>
<p><strong>Monthly rent (excluding charges):</strong> {{monthly_rent}} EUR</p>
<p><strong>Flat-rate charges (final, no adjustment):</strong> {{charges}} EUR</p>
<p><strong>Monthly total (rent + charges):</strong> {{total_monthly}} EUR</p>
<p><strong>Security deposit:</strong> {{security_deposit}} EUR</p>

<h3>A. Rent setting</h3>
<p>The monthly rent is set at {{monthly_rent}} EUR for the entire duration of the contract. No revision applies.</p>

<h3>B. Flat-rate charges</h3>
<p>The charges are fixed definitively at {{charges}} EUR per month. They will not be subject to any subsequent adjustment.</p>

<h3>C. Payment terms</h3>
<p>Payment of rent and charges is made through the HelloFonty platform. Rent is payable monthly in advance. A pro-rata applies if the stay begins or ends mid-month, calculated based on the number of days of occupancy.</p>

<h3>D. Security deposit</h3>
<p>{{deposit_clause}}</p>', 5, true, true, 'en'),

('obligations', 'Obligations of the parties', '<h2>V. Obligations of the parties</h2>

<h3>A. Lessor''s obligations</h3>
<p>The lessor undertakes to:</p>
<ul>
<li>Deliver to the tenant decent accommodation presenting no manifest risks to physical safety or health</li>
<li>Ensure the tenant''s peaceful enjoyment of the property</li>
<li>Maintain the premises in a condition suitable for the use intended by the contract</li>
<li>Carry out necessary repairs other than those falling to the tenant</li>
</ul>

<h3>B. Tenant''s obligations</h3>
<p>The tenant undertakes to:</p>
<ul>
<li>Pay rent and charges on the agreed terms</li>
<li>Use the premises peacefully in accordance with the purpose defined in the contract</li>
<li>Be liable for damage and losses occurring during the contract period</li>
<li>Subscribe to insurance covering rental risks (fire, water damage, explosion)</li>
<li>Maintain the accommodation in good condition and carry out tenant repairs</li>
<li>Not alter the premises without the lessor''s written agreement</li>
</ul>

{{house_rules_section}}', 6, true, true, 'en'),

('inventory', 'Inventory and condition report', '<h2>VI. Inventory and condition report</h2>
<p>A contradictory condition report and furniture inventory will be drawn up when the keys are handed over and when they are returned.</p>
<p>These documents, drawn up amicably and contradictorily between the parties or by a mandated third party, are an integral part of this contract.</p>', 7, true, true, 'en'),

('insurance', 'Insurance', '<h2>VII. Insurance</h2>
<p>The tenant must compulsorily subscribe to insurance covering rental risks (fire, water damage, explosion) and provide proof when the keys are handed over, then annually at the lessor''s request.</p>
<p>Lack of insurance constitutes a legitimate and serious ground for termination of the lease at the tenant''s fault.</p>', 8, true, true, 'en'),

('termination', 'Termination of the contract', '<h2>VIII. Termination of the contract</h2>
<p>No early termination is possible except with the lessor''s written agreement. If departure is accepted by the lessor, the tenant remains liable for rent and charges until the end of the contract, unless the property is re-let to another tenant for a period overlapping the remaining period.</p>', 9, true, true, 'en'),

('termination_clause', 'Resolutory clause', '<h2>IX. Resolutory clause, penalty clause and solidarity</h2>
<p>This lease shall be automatically terminated in the event of:</p>
<ul>
<li>Failure to pay rent or charges on their due date</li>
<li>Non-payment of the security deposit (if applicable)</li>
<li>Failure to subscribe to insurance against rental risks</li>
<li>Neighbourhood disturbances established by court decision</li>
</ul>
<p>Automatic termination may only occur after a formal notice to pay remains unsuccessful for more than two months.</p>', 10, true, true, 'en'),

('custom_clauses', 'Special clauses', '<h2>X. Special clauses</h2>
{{custom_clauses}}', 11, true, true, 'en'),

('final', 'Final provisions', '<h2>XI. Final provisions</h2>
<p>The parties declare having read and accepted the terms of this contract and the applicable legal and regulatory provisions.</p>
<p>Any modification to this contract must be the subject of an amendment signed by both parties.</p>
<p>In the event of a dispute, the parties shall endeavour to find an amicable solution before any legal action. Failing this, the French courts shall have sole jurisdiction.</p>
<p style="margin-top: 15px;"><strong>This contract is drafted in French and in English; in case of discrepancy, the French version prevails.</strong></p>', 12, true, true, 'en'),

('signatures', 'Signatures', '<h2>Signatures</h2>
<p>Drawn up at Fontainebleau, on {{today}}, in two original copies, one of which is given to each party.</p>
<p>The parties acknowledge having read all the provisions of this contract before signing it. Each party has an original copy of the lease.</p>', 13, false, true, 'en'),

('annexes', 'Appendices', '<h2>Appendices to be attached to the contract</h2>
<p>The following documents must be appended to this contract:</p>
<ul>
<li>Detailed move-in condition report</li>
<li>Furniture and equipment inventory</li>
<li>Tenant''s home insurance certificate</li>
<li>School enrollment certificate (institution and period)</li>
</ul>', 14, true, true, 'en')

ON CONFLICT (section_key, language) DO UPDATE SET
  content = EXCLUDED.content,
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  is_editable = EXCLUDED.is_editable,
  updated_at = now();

-- ============================================================
-- 4. FONCTION DE VALIDATION DE DURÉE + CUMUL
-- ============================================================

CREATE OR REPLACE FUNCTION validate_booking_duration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_duration_days integer;
  v_existing_days integer;
  v_new_days integer;
  v_max_days integer := 240;
BEGIN
  -- Calcul de la durée en jours
  v_duration_days := NEW.end_date - NEW.start_date;

  -- Vérification: durée < 8 mois (240 jours)
  IF v_duration_days >= v_max_days THEN
    RAISE EXCEPTION 'Les séjours hellofonty sont limités à moins de 8 mois. Pour un séjour plus long, contactez-nous.';
  END IF;

  -- Vérification du cumul par locataire sur le même logement
  -- On ne vérifie le cumul que sur INSERT (pas sur UPDATE)
  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(SUM(b.end_date - b.start_date), 0)
    INTO v_existing_days
    FROM bookings b
    WHERE b.student_id = NEW.student_id
      AND b.listing_id = NEW.listing_id
      AND b.status IN ('pending', 'confirmed');

    IF v_existing_days + v_duration_days >= v_max_days THEN
      RAISE EXCEPTION 'Ce logement ne peut pas être réservé à nouveau par le même locataire au-delà de 8 mois cumulés. Contactez hellofonty.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger sur bookings (INSERT)
DROP TRIGGER IF EXISTS trigger_validate_booking_duration ON bookings;
CREATE TRIGGER trigger_validate_booking_duration
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_booking_duration();

-- Trigger sur leases (UPDATE) pour valider les modifications de dates
CREATE OR REPLACE FUNCTION validate_lease_duration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_duration_days integer;
  v_max_days integer := 240;
BEGIN
  v_duration_days := NEW.end_date - NEW.start_date;

  IF v_duration_days >= v_max_days THEN
    RAISE EXCEPTION 'La durée du bail ne peut pas atteindre ou dépasser 8 mois.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_lease_duration ON leases;
CREATE TRIGGER trigger_validate_lease_duration
  BEFORE UPDATE OF start_date, end_date ON leases
  FOR EACH ROW
  EXECUTE FUNCTION validate_lease_duration();
