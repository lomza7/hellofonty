/*
# Create contract template sections table

1. New Tables
  - `contract_template_sections`
    - `id` (uuid, primary key)
    - `section_key` (text, unique) - identifiant technique de la section
    - `title` (text) - titre affiche de la section
    - `content` (text) - contenu HTML de la section avec placeholders
    - `display_order` (integer) - ordre d'affichage
    - `is_active` (boolean) - section active ou non
    - `is_editable` (boolean) - si l'admin peut modifier le contenu
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

2. Security
  - Enable RLS
  - Public SELECT for authenticated users (needed to generate contracts)
  - Admin-only INSERT/UPDATE/DELETE

3. Notes
  - Sections use placeholder variables like {{landlord_name}}, {{tenant_name}}, etc.
  - Pre-populated with default contract sections
*/

CREATE TABLE IF NOT EXISTS contract_template_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text UNIQUE NOT NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_editable boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE contract_template_sections ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read (needed for contract generation)
DROP POLICY IF EXISTS "select_contract_template_sections" ON contract_template_sections;
CREATE POLICY "select_contract_template_sections" ON contract_template_sections FOR SELECT
  TO authenticated USING (true);

-- Only admins can insert
DROP POLICY IF EXISTS "admin_insert_contract_template_sections" ON contract_template_sections;
CREATE POLICY "admin_insert_contract_template_sections" ON contract_template_sections FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Only admins can update
DROP POLICY IF EXISTS "admin_update_contract_template_sections" ON contract_template_sections;
CREATE POLICY "admin_update_contract_template_sections" ON contract_template_sections FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Only admins can delete
DROP POLICY IF EXISTS "admin_delete_contract_template_sections" ON contract_template_sections;
CREATE POLICY "admin_delete_contract_template_sections" ON contract_template_sections FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Insert default contract sections
INSERT INTO contract_template_sections (section_key, title, content, display_order, is_editable) VALUES
('header', 'En-tete du contrat', '<h1>Contrat de Location</h1>
<div class="subtitle">{{lease_type_label}} - Usage d''habitation</div>
<div class="legal-ref">Soumis au titre Ier bis de la loi n 89-462 du 6 juillet 1989<br>et aux dispositions de la loi ALUR du 24 mars 2014</div>', 1, true),

('parties', 'Designation des parties', '<h2>I. Designation des parties</h2>
<h3>Le Bailleur</h3>
<p><strong>Nom et Prenom :</strong> {{landlord_name}}</p>
<p><strong>Qualite :</strong> Personne physique</p>
<p><em>Ci-apres designe Le Bailleur</em></p>

<h3>Le Locataire</h3>
<p><strong>Nom et Prenom :</strong> {{tenant_name}}</p>
{{tenant_phone}}
<p><em>Ci-apres designe Le Locataire</em></p>', 2, true),

('object', 'Objet du contrat', '<h2>II. Objet du contrat</h2>
<p>Le present contrat a pour objet la location d''un logement meuble ainsi determine :</p>
<h3>A. Consistance du logement</h3>
<p><strong>Adresse :</strong> {{listing_address}}</p>
<p><strong>Type d''habitat :</strong> Logement meuble</p>
<p><strong>Description :</strong> {{listing_title}}</p>
<h3>B. Destination des locaux</h3>
<p>Le logement est destine exclusivement a l''usage d''habitation et constitue la residence principale du locataire.</p>', 3, true),

('duration', 'Date de prise d''effet et duree', '<h2>III. Date de prise d''effet et duree du contrat</h2>
<p><strong>Date de prise d''effet :</strong> {{start_date}}</p>
<p><strong>Date de fin prevue :</strong> {{end_date}}</p>
<p><strong>Duree du contrat :</strong> {{duration_months}} mois</p>
<p><strong>Type de bail :</strong> {{bail_type}}</p>', 4, true),

('financial', 'Conditions financieres', '<h2>IV. Conditions financieres</h2>
<p><strong>Loyer mensuel (hors charges) :</strong> {{monthly_rent}} EUR</p>
<p><strong>Charges mensuelles :</strong> {{charges}} EUR</p>
<p><strong>Total mensuel :</strong> {{total_monthly}} EUR</p>
<p><strong>Depot de garantie :</strong> {{security_deposit}} EUR</p>

<h3>A. Fixation et revision du loyer</h3>
<p>Le loyer mensuel initial est fixe a {{monthly_rent}} EUR. Le loyer sera revise annuellement a la date anniversaire du contrat, en fonction de la variation de l''indice de reference des loyers (IRL) publie par l''INSEE.</p>

<h3>B. Charges recuperables</h3>
<p>Le montant des charges est fixe forfaitairement a {{charges}} EUR par mois.</p>

<h3>C. Modalites de paiement</h3>
<p>Le loyer et les charges sont payables mensuellement et d''avance, le premier jour de chaque mois. Le paiement s''effectue par virement bancaire ou par tout autre moyen convenu entre les parties.</p>

<h3>D. Depot de garantie</h3>
<p>{{deposit_clause}}</p>', 5, true),

('obligations', 'Obligations des parties', '<h2>V. Obligations des parties</h2>

<h3>A. Obligations du bailleur</h3>
<p>Le bailleur s''engage a :</p>
<ul>
<li>Delivrer au locataire un logement decent ne laissant pas apparaitre de risques manifestes pouvant porter atteinte a la securite physique ou a la sante</li>
<li>Assurer au locataire la jouissance paisible du logement</li>
<li>Entretenir les locaux en etat de servir a l''usage prevu par le contrat</li>
<li>Effectuer les reparations necessaires autres que locatives</li>
</ul>

<h3>B. Obligations du locataire</h3>
<p>Le locataire s''engage a :</p>
<ul>
<li>Payer le loyer et les charges aux termes convenus</li>
<li>User paisiblement du logement suivant la destination prevue au contrat</li>
<li>Repondre des degradations et pertes survenues pendant la duree du contrat</li>
<li>Souscrire une assurance contre les risques locatifs (incendie, degats des eaux, explosion)</li>
<li>Maintenir le logement en bon etat d''entretien et effectuer les reparations locatives</li>
<li>Ne pas transformer les lieux sans l''accord ecrit du bailleur</li>
</ul>

{{house_rules_section}}', 6, true),

('inventory', 'Etat des lieux et inventaire', '<h2>VI. Etat des lieux et inventaire</h2>
<p>Un etat des lieux contradictoire et un inventaire du mobilier seront etablis lors de la remise des cles et lors de leur restitution.</p>
<p>Ces documents, etablis de facon amiable et contradictoire entre les parties ou par un tiers mandate, font partie integrante du present contrat.</p>', 7, true),

('insurance', 'Assurance', '<h2>VII. Assurance</h2>
<p>Le locataire doit obligatoirement souscrire une assurance garantissant les risques locatifs (incendie, degats des eaux, explosion) et en justifier lors de la remise des cles puis chaque annee a la demande du bailleur.</p>
<p>Le defaut d''assurance constitue un motif legitime et serieux de resiliation du bail aux torts du locataire.</p>', 8, true),

('termination', 'Resiliation du contrat', '<h2>VIII. Resiliation du contrat</h2>

<h3>A. Resiliation par le locataire</h3>
<p>Le locataire peut resilier le bail a tout moment en respectant un preavis d''un mois.</p>
<p>Le preavis debute a la date de reception par le bailleur de la lettre recommandee avec accuse de reception ou de la remise en main propre contre recepisse ou emargement.</p>

<h3>B. Resiliation par le bailleur</h3>
<p>Le bailleur ne peut pas resilier un {{bail_type_short}} avant son terme, sauf motif legitime et serieux.</p>', 9, true),

('termination_clause', 'Clause resolutoire', '<h2>IX. Clause resolutoire</h2>
<p>Le present bail sera resilie de plein droit en cas de :</p>
<ul>
<li>Defaut de paiement du loyer ou des charges a leur echeance</li>
<li>Non-versement du depot de garantie (si applicable)</li>
<li>Defaut de souscription d''assurance contre les risques locatifs</li>
<li>Troubles de voisinage constates par decision de justice</li>
</ul>
<p>La resiliation de plein droit ne pourra intervenir qu''apres un commandement de payer demeure infructueux pendant plus de deux mois.</p>', 10, true),

('custom_clauses', 'Clauses particulieres', '<h2>X. Clauses particulieres</h2>
{{custom_clauses}}', 11, true),

('final', 'Dispositions finales', '<h2>XI. Dispositions finales</h2>
<p>Les parties declarent avoir pris connaissance et accepter les termes du present contrat ainsi que des dispositions legales et reglementaires applicables.</p>
<p>Toute modification du present contrat devra faire l''objet d''un avenant signe par les deux parties.</p>
<p>En cas de litige, les parties s''efforceront de trouver une solution amiable avant toute action judiciaire. A defaut, les tribunaux francais seront seuls competents.</p>', 12, true),

('signatures', 'Signatures', '<h2>Signatures</h2>
<p>Fait a Fontainebleau, le {{today}}, en deux exemplaires originaux dont un remis a chaque partie.</p>
<p>Les parties reconnaissent avoir pris connaissance de l''ensemble des dispositions du present contrat avant de le signer. Chaque partie dispose d''un exemplaire original du bail.</p>', 13, false),

('annexes', 'Annexes', '<h2>Annexes a joindre au contrat</h2>
<p>Les documents suivants doivent etre annexes au present contrat :</p>
<ul>
<li>Diagnostic de Performance Energetique (DPE)</li>
<li>Etat des lieux d''entree detaille</li>
<li>Inventaire du mobilier et des equipements</li>
<li>Notice d''information sur les droits et obligations du locataire</li>
<li>Attestation d''assurance habitation du locataire</li>
</ul>', 14, true)

ON CONFLICT (section_key) DO NOTHING;
