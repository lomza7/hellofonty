import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function generateLeaseHTML(lease: any, landlord: any, tenant: any, listing: any): string {
  const startDate = new Date(lease.start_date).toLocaleDateString('fr-FR');
  const endDate = new Date(lease.end_date).toLocaleDateString('fr-FR');
  const today = new Date().toLocaleDateString('fr-FR');

  const durationMonths = Math.round(
    (new Date(lease.end_date).getTime() - new Date(lease.start_date).getTime()) / (1000 * 60 * 60 * 24 * 30)
  );

  const leaseTypeLabel = lease.lease_type === 'furnished' ? 'Meublé' :
                        lease.lease_type === 'unfurnished' ? 'Non meublé' :
                        'Étudiant (Meublé)';

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contrat de Location - ${listing.title}</title>
  <style>
    @page {
      size: A4;
      margin: 2.5cm 2cm;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a1a;
    }

    .contract-header {
      text-align: center;
      border: 3px double #2563eb;
      padding: 20px;
      margin-bottom: 30px;
      background: linear-gradient(to bottom, #f8fafc, #ffffff);
    }

    .contract-header h1 {
      font-size: 20pt;
      font-weight: 700;
      color: #1e40af;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .contract-header .subtitle {
      font-size: 12pt;
      color: #475569;
      font-weight: 600;
      margin-top: 5px;
    }

    .contract-header .legal-ref {
      font-size: 9pt;
      color: #64748b;
      margin-top: 10px;
      font-style: italic;
      line-height: 1.4;
    }

    .section {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 13pt;
      font-weight: 700;
      color: #1e40af;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 2px solid #2563eb;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .subsection-title {
      font-size: 11pt;
      font-weight: 700;
      color: #1e3a8a;
      margin: 15px 0 8px 0;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px 25px;
      margin: 10px 0;
    }

    .info-item {
      padding: 8px 0;
      border-bottom: 1px dotted #cbd5e1;
    }

    .info-label {
      font-weight: 600;
      color: #334155;
      display: inline-block;
      min-width: 140px;
    }

    .info-value {
      color: #1a1a1a;
    }

    .article {
      margin: 15px 0;
      padding-left: 15px;
    }

    .article-number {
      font-weight: 700;
      color: #1e40af;
    }

    .highlight-box {
      background: #eff6ff;
      border-left: 4px solid #2563eb;
      padding: 15px;
      margin: 15px 0;
      border-radius: 4px;
    }

    .financial-summary {
      background: #f1f5f9;
      border: 2px solid #cbd5e1;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
    }

    .financial-summary table {
      width: 100%;
      border-collapse: collapse;
    }

    .financial-summary td {
      padding: 10px;
      border-bottom: 1px solid #cbd5e1;
    }

    .financial-summary td:first-child {
      font-weight: 600;
      color: #334155;
      width: 60%;
    }

    .financial-summary td:last-child {
      text-align: right;
      font-weight: 700;
      color: #1e40af;
      font-size: 12pt;
    }

    .financial-summary .total-row td {
      border-top: 2px solid #2563eb;
      border-bottom: 2px solid #2563eb;
      padding-top: 12px;
      font-size: 13pt;
      color: #1e3a8a;
    }

    .signatures {
      margin-top: 50px;
      page-break-inside: avoid;
    }

    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 20px;
    }

    .signature-box {
      border: 2px solid #cbd5e1;
      border-radius: 8px;
      padding: 20px;
      min-height: 180px;
      background: #ffffff;
    }

    .signature-title {
      font-weight: 700;
      color: #1e3a8a;
      margin-bottom: 15px;
      font-size: 11pt;
      text-align: center;
      padding-bottom: 10px;
      border-bottom: 1px solid #e2e8f0;
    }

    .signature-name {
      margin-top: 10px;
      font-size: 10pt;
      color: #475569;
      text-align: center;
    }

    .signature-date {
      margin-top: 5px;
      font-size: 9pt;
      color: #64748b;
      font-style: italic;
      text-align: center;
    }

    .signature-line {
      margin-top: 60px;
      border-bottom: 2px solid #1e3a8a;
      text-align: center;
      padding-bottom: 2px;
    }

    .legal-notice {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px;
      margin: 15px 0;
      font-size: 9pt;
      color: #78350f;
      line-height: 1.5;
    }

    .legal-notice strong {
      color: #92400e;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #e2e8f0;
      text-align: center;
      color: #64748b;
      font-size: 9pt;
    }

    .page-break {
      page-break-before: always;
    }

    ul {
      margin-left: 25px;
      margin-top: 8px;
    }

    li {
      margin-bottom: 5px;
    }

    strong {
      color: #1e3a8a;
    }
  </style>
</head>
<body>

  <div class="contract-header">
    <h1>Contrat de Location</h1>
    <div class="subtitle">${leaseTypeLabel} - Usage d'habitation</div>
    <div class="legal-ref">
      Soumis au titre Ier bis de la loi n° 89-462 du 6 juillet 1989<br>
      et aux dispositions de la loi ALUR du 24 mars 2014
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">I. Désignation des parties</h2>

    <div class="highlight-box">
      <div class="subsection-title">Le Bailleur</div>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Nom et Prénom :</span>
          <span class="info-value">${landlord.first_name} ${landlord.last_name}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Qualité :</span>
          <span class="info-value">Personne physique</span>
        </div>
      </div>
      <p style="margin-top: 10px; font-style: italic; color: #475569;">Ci-après désigné « Le Bailleur »</p>
    </div>

    <div class="highlight-box">
      <div class="subsection-title">Le Locataire</div>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Nom et Prénom :</span>
          <span class="info-value">${tenant.first_name} ${tenant.last_name}</span>
        </div>
        ${tenant.phone ? `
        <div class="info-item">
          <span class="info-label">Téléphone :</span>
          <span class="info-value">${tenant.phone}</span>
        </div>
        ` : ''}
      </div>
      <p style="margin-top: 10px; font-style: italic; color: #475569;">Ci-après désigné « Le Locataire »</p>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">II. Objet du contrat</h2>

    <p>Le présent contrat a pour objet la location d'un logement meublé ainsi déterminé :</p>

    <div class="subsection-title">A. Consistance du logement</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Adresse :</span>
        <span class="info-value">${listing.address}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Type d'habitat :</span>
        <span class="info-value">Logement meublé</span>
      </div>
    </div>

    <div class="article">
      <span class="article-number">Description :</span>
      <p style="margin-top: 8px;">${listing.title}</p>
    </div>

    <div class="subsection-title">B. Destination des locaux</div>
    <p>Le logement est destiné exclusivement à <strong>l'usage d'habitation</strong> et constitue la résidence principale du locataire.</p>

    ${listing.video_url ? `
    <div class="legal-notice">
      <strong>Note :</strong> Le locataire reconnaît avoir visité les lieux ou avoir eu accès à une visite virtuelle du logement avant la signature du présent contrat.
    </div>
    ` : ''}
  </div>

  <div class="section">
    <h2 class="section-title">III. Date de prise d'effet et durée du contrat</h2>

    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Date de prise d'effet :</span>
        <span class="info-value">${startDate}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Date de fin prévue :</span>
        <span class="info-value">${endDate}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Durée du contrat :</span>
        <span class="info-value">${durationMonths} mois</span>
      </div>
      <div class="info-item">
        <span class="info-label">Type de bail :</span>
        <span class="info-value">${lease.lease_type === 'student' ? 'Bail étudiant (9 mois)' : 'Bail mobilité (1 à 10 mois)'}</span>
      </div>
    </div>

  </div>

  <div class="page-break"></div>

  <div class="section">
    <h2 class="section-title">IV. Conditions financières</h2>

    <div class="financial-summary">
      <table>
        <tr>
          <td>Loyer mensuel (hors charges)</td>
          <td>${lease.monthly_rent.toFixed(2)} €</td>
        </tr>
        <tr>
          <td>Charges mensuelles (provision ou forfait)</td>
          <td>${lease.charges.toFixed(2)} €</td>
        </tr>
        <tr class="total-row">
          <td>Total mensuel (loyer + charges)</td>
          <td>${(lease.monthly_rent + lease.charges).toFixed(2)} €</td>
        </tr>
        <tr>
          <td>Dépôt de garantie</td>
          <td>${lease.security_deposit.toFixed(2)} €</td>
        </tr>
      </table>
    </div>

    <div class="subsection-title">A. Fixation et révision du loyer</div>
    <div class="article">
      <p><span class="article-number">Article 1 :</span> Le loyer mensuel initial est fixé à <strong>${lease.monthly_rent.toFixed(2)} €</strong> (${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(lease.monthly_rent)} euros).</p>

      <p style="margin-top: 10px;"><span class="article-number">Article 2 :</span> Le loyer sera révisé annuellement à la date anniversaire du contrat, en fonction de la variation de l'indice de référence des loyers (IRL) publié par l'INSEE.</p>
    </div>

    <div class="subsection-title">B. Charges récupérables</div>
    <div class="article">
      <p><span class="article-number">Article 3 :</span> Le montant des charges est fixé forfaitairement à <strong>${lease.charges.toFixed(2)} €</strong> par mois.</p>

      <p style="margin-top: 10px;">Ce forfait couvre les dépenses suivantes :</p>
      <ul>
        ${listing.electricity_cost && listing.electricity_cost > 0 ? `<li>Électricité (provision : ${listing.electricity_cost.toFixed(2)} €)</li>` : ''}
        ${listing.heating_cost && listing.heating_cost > 0 ? `<li>Chauffage (provision : ${listing.heating_cost.toFixed(2)} €)</li>` : ''}
        ${listing.water_cost && listing.water_cost > 0 ? `<li>Eau (provision : ${listing.water_cost.toFixed(2)} €)</li>` : ''}
        <li>Entretien des parties communes</li>
        <li>Taxe d'enlèvement des ordures ménagères</li>
      </ul>
    </div>

    <div class="subsection-title">C. Modalités de paiement</div>
    <div class="article">
      <p><span class="article-number">Article 4 :</span> Le loyer et les charges sont payables mensuellement et d'avance, le <strong>premier jour de chaque mois</strong>.</p>

      <p style="margin-top: 10px;">Le paiement s'effectue par virement bancaire ou par tout autre moyen convenu entre les parties.</p>
    </div>

    <div class="subsection-title">D. Dépôt de garantie</div>
    <div class="article">
      ${lease.lease_type === 'furnished' && lease.security_deposit > 0 ? `
      <p><span class="article-number">Article 5 :</span> Un dépôt de garantie d'un montant de <strong>${lease.security_deposit.toFixed(2)} €</strong> (équivalent à ${(lease.security_deposit / lease.monthly_rent).toFixed(1)} mois de loyer hors charges) est versé à la signature du présent contrat.</p>

      <p style="margin-top: 10px;">Ce dépôt sera restitué dans un délai d'un mois après la remise des clés, déduction faite, le cas échéant, des sommes dues au bailleur et des frais de remise en état des lieux imputables au locataire.</p>
      ` : `
      <p><span class="article-number">Article 5 :</span> En application de la loi, <strong>aucun dépôt de garantie</strong> ne peut être exigé pour un bail mobilité.</p>
      `}
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">V. Obligations des parties</h2>

    <div class="subsection-title">A. Obligations du bailleur</div>
    <div class="article">
      <p>Le bailleur s'engage à :</p>
      <ul>
        <li>Délivrer au locataire un logement décent ne laissant pas apparaître de risques manifestes pouvant porter atteinte à la sécurité physique ou à la santé</li>
        <li>Assurer au locataire la jouissance paisible du logement</li>
        <li>Entretenir les locaux en état de servir à l'usage prévu par le contrat</li>
        <li>Effectuer les réparations nécessaires autres que locatives</li>
      </ul>
    </div>

    <div class="subsection-title">B. Obligations du locataire</div>
    <div class="article">
      <p>Le locataire s'engage à :</p>
      <ul>
        <li>Payer le loyer et les charges aux termes convenus</li>
        <li>User paisiblement du logement suivant la destination prévue au contrat</li>
        <li>Répondre des dégradations et pertes survenues pendant la durée du contrat</li>
        <li>Souscrire une assurance contre les risques locatifs (incendie, dégâts des eaux, explosion)</li>
        <li>Maintenir le logement en bon état d'entretien et effectuer les réparations locatives</li>
        <li>Ne pas transformer les lieux sans l'accord écrit du bailleur</li>
      </ul>
    </div>

    ${listing.house_rules ? `
    <div class="subsection-title">C. Règlement intérieur et règles d'usage</div>
    <div class="article">
      <p>Le locataire s'engage à respecter les règles suivantes :</p>
      <div style="background: #f8fafc; padding: 12px; margin-top: 8px; border-radius: 4px;">
        ${listing.house_rules.split('\n').map((rule: string) => `<p>• ${rule}</p>`).join('')}
      </div>
    </div>
    ` : ''}
  </div>

  <div class="page-break"></div>

  <div class="section">
    <h2 class="section-title">VI. État des lieux et inventaire</h2>

    <div class="article">
      <p><span class="article-number">Article 6 :</span> Un état des lieux contradictoire et un inventaire du mobilier seront établis lors de la remise des clés et lors de leur restitution.</p>

      <p style="margin-top: 10px;">Ces documents, établis de façon amiable et contradictoire entre les parties ou par un tiers mandaté, font partie intégrante du présent contrat.</p>

      ${lease.inventory_included ? `
      <div class="legal-notice">
        <strong>État des lieux :</strong> Un état des lieux d'entrée sera réalisé dans le cadre de ce contrat et annexé au présent bail.
      </div>
      ` : ''}
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">VII. Assurance</h2>

    <div class="article">
      <p><span class="article-number">Article 7 :</span> Le locataire doit obligatoirement souscrire une assurance garantissant les risques locatifs (incendie, dégâts des eaux, explosion) et en justifier lors de la remise des clés puis chaque année à la demande du bailleur.</p>

      <p style="margin-top: 10px;">Le défaut d'assurance constitue un motif légitime et sérieux de résiliation du bail aux torts du locataire.</p>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">VIII. Résiliation du contrat</h2>

    <div class="subsection-title">A. Résiliation par le locataire</div>
    <div class="article">
      <p><span class="article-number">Article 8 :</span> Le locataire peut résilier le bail à tout moment en respectant un préavis d'<strong>un mois</strong>.</p>

      <p style="margin-top: 10px;">Le préavis débute à la date de réception par le bailleur de la lettre recommandée avec accusé de réception ou de la remise en main propre contre récépissé ou émargement.</p>
    </div>

    <div class="subsection-title">B. Résiliation par le bailleur</div>
    <div class="article">
      <p><span class="article-number">Article 9 :</span> ${lease.lease_type === 'student' ?
        'Le bailleur ne peut pas résilier un bail étudiant avant son terme, sauf motif légitime et sérieux.' :
        'Le bailleur ne peut pas résilier un bail mobilité avant son terme, sauf motif légitime et sérieux.'
      }</p>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">IX. Clause résolutoire</h2>

    <div class="article">
      <p><span class="article-number">Article 10 :</span> Le présent bail sera résilié de plein droit en cas de :</p>
      <ul>
        <li>Défaut de paiement du loyer ou des charges à leur échéance</li>
        <li>Non-versement du dépôt de garantie (si applicable)</li>
        <li>Défaut de souscription d'assurance contre les risques locatifs</li>
        <li>Troubles de voisinage constatés par décision de justice</li>
      </ul>

      <p style="margin-top: 10px;">La résiliation de plein droit ne pourra intervenir qu'après un commandement de payer demeuré infructueux pendant plus de deux mois.</p>
    </div>
  </div>

  ${lease.terms_and_conditions ? `
  <div class="section">
    <h2 class="section-title">X. Clauses particulières</h2>

    <div class="article">
      <div class="highlight-box">
        ${lease.terms_and_conditions.split('\n').map((clause: string) => `<p style="margin-bottom: 8px;">${clause}</p>`).join('')}
      </div>
    </div>
  </div>
  ` : ''}

  <div class="section">
    <h2 class="section-title">XI. Dispositions finales</h2>

    <div class="article">
      <p><span class="article-number">Article 11 :</span> Les parties déclarent avoir pris connaissance et accepter les termes du présent contrat ainsi que des dispositions légales et réglementaires applicables.</p>

      <p style="margin-top: 10px;"><span class="article-number">Article 12 :</span> Toute modification du présent contrat devra faire l'objet d'un avenant signé par les deux parties.</p>

      <p style="margin-top: 10px;"><span class="article-number">Article 13 :</span> En cas de litige, les parties s'efforceront de trouver une solution amiable avant toute action judiciaire. À défaut, les tribunaux français seront seuls compétents.</p>
    </div>
  </div>

  <div class="page-break"></div>

  <div class="signatures">
    <h2 class="section-title">Signatures</h2>

    <p style="margin: 20px 0; text-align: center; font-style: italic;">
      Fait à Fontainebleau, le ${today}, en deux exemplaires originaux dont un remis à chaque partie.
    </p>

    <div class="legal-notice">
      Les parties reconnaissent avoir pris connaissance de l'ensemble des dispositions du présent contrat avant de le signer. Chaque partie dispose d'un exemplaire original du bail.
    </div>

    <div class="signature-grid">
      <div class="signature-box">
        <div class="signature-title">Le Bailleur</div>
        <div class="signature-line">Signature précédée de la mention<br>"Lu et approuvé"</div>
        <div class="signature-name">${landlord.first_name} ${landlord.last_name}</div>
        <div class="signature-date">Le ${today}</div>
      </div>

      <div class="signature-box">
        <div class="signature-title">Le Locataire</div>
        <div class="signature-line">Signature précédée de la mention<br>"Lu et approuvé"</div>
        <div class="signature-name">${tenant.first_name} ${tenant.last_name}</div>
        <div class="signature-date">Le ${today}</div>
      </div>
    </div>
  </div>

  <div class="section" style="margin-top: 40px;">
    <h2 class="section-title">Annexes à joindre au contrat</h2>

    <div class="article">
      <p>Les documents suivants doivent être annexés au présent contrat :</p>
      <ul>
        <li>✓ Diagnostic de Performance Énergétique (DPE)</li>
        <li>✓ État des lieux d'entrée détaillé</li>
        <li>✓ Inventaire du mobilier et des équipements</li>
        <li>✓ Notice d'information sur les droits et obligations du locataire</li>
        <li>✓ Attestation d'assurance habitation du locataire</li>
        ${listing.building_info ? '<li>✓ Règlement de copropriété (extraits concernant le locataire)</li>' : ''}
      </ul>
    </div>
  </div>

  <div class="footer">
    <p><strong>HelloFonty - Plateforme de Gestion Locative</strong></p>
    <p>Document généré le ${new Date().toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}</p>
    <p style="margin-top: 10px; font-size: 8pt; color: #94a3b8;">
      Ce contrat a été généré conformément à la loi n° 89-462 du 6 juillet 1989 et à la loi ALUR du 24 mars 2014.<br>
      Il est recommandé de consulter un professionnel du droit pour toute question juridique.
    </p>
  </div>

</body>
</html>
  `;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Invalid token');
    }

    const url = new URL(req.url);
    const leaseId = url.searchParams.get('id');
    if (!leaseId) {
      throw new Error('Missing lease ID');
    }

    const { data: lease, error: leaseError } = await supabase
      .from('leases')
      .select(`
        *,
        listing:listings(*),
        tenant:profiles!leases_tenant_id_fkey(*)
      `)
      .eq('id', leaseId)
      .single();

    if (leaseError) throw leaseError;

    if (lease.landlord_id !== user.id) {
      throw new Error('Unauthorized');
    }

    const { data: landlord } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', lease.landlord_id)
      .single();

    const html = generateLeaseHTML(lease, landlord, lease.tenant, lease.listing);

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="Bail_${lease.listing.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.html"`,
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});