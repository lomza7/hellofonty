import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function replaceVariables(content: string, vars: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

interface SignatureData {
  name: string;
  signed_at: string;
  signed_by: string;
}

function formatSignatureDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  try {
    return new Date(isoDate).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
}

function buildSignedColumn(sig: SignatureData, roleLabel: string): string {
  const dateStr = formatSignatureDate(sig.signed_at);
  return `
  <div class="sig-column">
    <div class="sig-name">${sig.name}</div>
    <div class="sig-line"></div>
    <div class="sig-role">${roleLabel}</div>
    <div class="sig-date">Fait le ${dateStr}</div>
  </div>`;
}

function buildContractHTML(
  sections: Array<{ content: string }>,
  vars: Record<string, string>,
  landlordSig: SignatureData | null,
  tenantSig: SignatureData | null,
): string {
  const bodyContent = sections
    .map(s => `<div class="section">${replaceVariables(s.content, vars)}</div>`)
    .join('\n');

  const bothSigned = landlordSig && landlordSig.name && tenantSig && tenantSig.name;
  const signatureBlock = bothSigned
    ? `<div class="page-break"></div>
<div class="signature-grid">
${buildSignedColumn(landlordSig, 'Le BAILLEUR ou son MANDATAIRE')}
${buildSignedColumn(tenantSig, 'Le(s) LOCATAIRE(S)')}
</div>`
    : '';

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contrat de Location</title>
  <style>
    @page { size: A4; margin: 2.5cm 2cm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Georgia', 'Times New Roman', serif; font-size: 11pt; line-height: 1.6; color: #1a1a1a; padding: 40px; }
    h1 { font-size: 20pt; font-weight: 700; color: #1e40af; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; text-align: center; }
    h2 { font-size: 13pt; font-weight: 700; color: #1e40af; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #2563eb; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 30px; }
    h3 { font-size: 11pt; font-weight: 700; color: #1e3a8a; margin: 15px 0 8px 0; }
    .section { margin-bottom: 25px; page-break-inside: avoid; }
    .subtitle { text-align: center; font-size: 12pt; color: #475569; font-weight: 600; margin-top: 5px; }
    .legal-ref { text-align: center; font-size: 9pt; color: #64748b; margin-top: 10px; font-style: italic; line-height: 1.4; }
    ul { margin-left: 25px; margin-top: 8px; }
    li { margin-bottom: 5px; }
    strong { color: #1e3a8a; }
    p { margin-bottom: 8px; }
    .page-break { page-break-before: always; }
    .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 40px; }
    .sig-column { text-align: left; }
    .sig-name { font-weight: 700; font-size: 11pt; color: #1a1a1a; margin-bottom: 8px; }
    .sig-line { border-bottom: 1.5px solid #1a1a1a; margin-bottom: 8px; }
    .sig-role { font-size: 10pt; color: #1e40af; font-weight: 600; margin-bottom: 6px; }
    .sig-date { font-size: 10pt; color: #1e40af; font-weight: 700; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; text-align: center; color: #64748b; font-size: 9pt; }
  </style>
</head>
<body>
${bodyContent}

${signatureBlock}

<div class="footer">
  <p><strong>HelloFonty - Plateforme de Mise en Relation</strong></p>
  <p>Document genere le ${new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
</div>
</body>
</html>`;
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

    const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'fr';

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

    if (lease.landlord_id !== user.id && lease.tenant_id !== user.id) {
      throw new Error('Unauthorized');
    }

    // Validation: durée < 8 mois
    const durationDays = Math.round(
      (new Date(lease.end_date).getTime() - new Date(lease.start_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (durationDays >= 240) {
      throw new Error('La durée du bail dépasse la limite de 8 mois.');
    }

    const { data: landlord } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', lease.landlord_id)
      .single();

    // Fetch template sections from database (filtered by language)
    const { data: templateSections, error: templateError } = await supabase
      .from('contract_template_sections')
      .select('*')
      .eq('is_active', true)
      .eq('language', lang)
      .order('display_order', { ascending: true });

    const listing = lease.listing;
    const tenant = lease.tenant;

    const startDate = new Date(lease.start_date).toLocaleDateString('fr-FR');
    const endDate = new Date(lease.end_date).toLocaleDateString('fr-FR');
    const today = new Date().toLocaleDateString('fr-FR');
    const durationMonths = Math.round(
      (new Date(lease.end_date).getTime() - new Date(lease.start_date).getTime()) / (1000 * 60 * 60 * 24 * 30)
    ).toString();

    const depositClause = lease.security_deposit > 0
      ? `Un depot de garantie d'un montant de ${lease.security_deposit.toFixed(2)} EUR est verse a la signature du present contrat. Ce depot sera restitue dans un delai d'un mois apres la remise des cles, deduction faite, le cas echeant, des sommes dues au bailleur.`
      : `Un depot de garantie d'un montant equivalent a un mois de loyer hors charges est verse a la signature du present contrat. Ce depot sera restitue dans un delai d'un mois apres la remise des cles, deduction faite, le cas echeant, des sommes dues au bailleur.`;

    const houseRulesSection = listing.house_rules
      ? `<h3>C. Reglement interieur et regles d'usage</h3><p>Le locataire s'engage a respecter les regles suivantes :</p><ul>${listing.house_rules.split('\n').map((r: string) => `<li>${r}</li>`).join('')}</ul>`
      : '';

    const customClauses = lease.terms_and_conditions
      ? lease.terms_and_conditions.split('\n').map((c: string) => `<p>${c}</p>`).join('')
      : lang === 'fr' ? '<p>Aucune clause particuliere.</p>' : '<p>No special clauses.</p>';

    // Récupérer l'email du bailleur via la fonction get_user_email
    let landlordEmail = '';
    try {
      const { data: emailData } = await supabase.rpc('get_user_email', { user_id: lease.landlord_id });
      landlordEmail = emailData || '';
    } catch { /* ignore */ }

    // Récupérer l'email du locataire
    let tenantEmail = '';
    try {
      const { data: emailData } = await supabase.rpc('get_user_email', { user_id: lease.tenant_id });
      tenantEmail = emailData || '';
    } catch { /* ignore */ }

    const landlordAddress = landlord.address || '';
    const tenantPermanentAddress = tenant.address || '';

    const vars: Record<string, string> = {
      '{{landlord_name}}': `${landlord.first_name} ${landlord.last_name}`,
      '{{landlord_address}}': landlordAddress,
      '{{landlord_email}}': landlordEmail,
      '{{tenant_name}}': `${tenant.first_name} ${tenant.last_name}`,
      '{{tenant_phone}}': tenant.phone ? `<p><strong>${lang === 'fr' ? 'Téléphone' : 'Phone'}:</strong> ${tenant.phone}</p>` : '',
      '{{tenant_email}}': tenantEmail,
      '{{tenant_permanent_address}}': tenantPermanentAddress,
      '{{listing_address}}': listing.address || '',
      '{{listing_title}}': listing.title || '',
      '{{start_date}}': startDate,
      '{{end_date}}': endDate,
      '{{duration_months}}': durationMonths,
      '{{monthly_rent}}': lease.monthly_rent.toFixed(2),
      '{{charges}}': lease.charges.toFixed(2),
      '{{total_monthly}}': (lease.monthly_rent + lease.charges).toFixed(2),
      '{{security_deposit}}': lease.security_deposit.toFixed(2),
      '{{deposit_clause}}': depositClause,
      '{{house_rules_section}}': houseRulesSection,
      '{{custom_clauses}}': customClauses,
      '{{today}}': today,
    };

    let html: string;

    if (templateSections && templateSections.length > 0 && !templateError) {
      html = buildContractHTML(templateSections, vars, lease.landlord_signature as SignatureData | null, lease.tenant_signature as SignatureData | null);
    } else {
      // Fallback: generate basic contract if no template found
      const fallbackSections = [
        { content: `<h1>Contrat de Location</h1><div class="subtitle">Meuble - Usage d'habitation</div>` },
        { content: `<h2>I. Designation des parties</h2><p><strong>Bailleur :</strong> ${vars['{{landlord_name}}']}</p><p><strong>Locataire :</strong> ${vars['{{tenant_name}}']}</p>` },
        { content: `<h2>II. Objet</h2><p><strong>Adresse :</strong> ${vars['{{listing_address}}']}</p><p>${vars['{{listing_title}}']}</p>` },
        { content: `<h2>III. Duree</h2><p>Du ${startDate} au ${endDate} (${durationMonths} mois)</p>` },
        { content: `<h2>IV. Loyer</h2><p>Loyer : ${vars['{{monthly_rent}}']} EUR | Charges : ${vars['{{charges}}']} EUR | Total : ${vars['{{total_monthly}}']} EUR</p>` },
      ];
      html = buildContractHTML(fallbackSections, vars, lease.landlord_signature as SignatureData | null, lease.tenant_signature as SignatureData | null);
    }

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="Bail_${listing.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.html"`,
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
