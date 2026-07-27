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

function buildContractHTML(sections: Array<{ content: string }>, vars: Record<string, string>): string {
  const bodyContent = sections
    .map(s => `<div class="section">${replaceVariables(s.content, vars)}</div>`)
    .join('\n');

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
    .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 20px; }
    .signature-box { border: 2px solid #cbd5e1; border-radius: 8px; padding: 20px; min-height: 180px; }
    .signature-title { font-weight: 700; color: #1e3a8a; margin-bottom: 15px; text-align: center; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }
    .signature-line { margin-top: 60px; border-bottom: 2px solid #1e3a8a; text-align: center; padding-bottom: 2px; }
    .signature-name { margin-top: 10px; font-size: 10pt; color: #475569; text-align: center; }
    .signature-date { margin-top: 5px; font-size: 9pt; color: #64748b; font-style: italic; text-align: center; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; text-align: center; color: #64748b; font-size: 9pt; }
  </style>
</head>
<body>
${bodyContent}

<div class="page-break"></div>
<div class="signature-grid">
  <div class="signature-box">
    <div class="signature-title">Le Bailleur</div>
    <div class="signature-line">Signature precedee de la mention<br>"Lu et approuve"</div>
    <div class="signature-name">${vars['{{landlord_name}}']}</div>
    <div class="signature-date">Le ${vars['{{today}}']}</div>
  </div>
  <div class="signature-box">
    <div class="signature-title">Le Locataire</div>
    <div class="signature-line">Signature precedee de la mention<br>"Lu et approuve"</div>
    <div class="signature-name">${vars['{{tenant_name}}']}</div>
    <div class="signature-date">Le ${vars['{{today}}']}</div>
  </div>
</div>

<div class="footer">
  <p><strong>HelloFonty - Plateforme de Gestion Locative</strong></p>
  <p>Document genere le ${new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
  <p style="margin-top: 10px; font-size: 8pt; color: #94a3b8;">
    Ce contrat a ete genere conformement a la loi n 89-462 du 6 juillet 1989 et a la loi ALUR du 24 mars 2014.<br>
    Il est recommande de consulter un professionnel du droit pour toute question juridique.
  </p>
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

    // Fetch template sections from database
    const { data: templateSections, error: templateError } = await supabase
      .from('contract_template_sections')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    const listing = lease.listing;
    const tenant = lease.tenant;

    const startDate = new Date(lease.start_date).toLocaleDateString('fr-FR');
    const endDate = new Date(lease.end_date).toLocaleDateString('fr-FR');
    const today = new Date().toLocaleDateString('fr-FR');
    const durationMonths = Math.round(
      (new Date(lease.end_date).getTime() - new Date(lease.start_date).getTime()) / (1000 * 60 * 60 * 24 * 30)
    ).toString();

    const leaseTypeLabel = lease.lease_type === 'furnished' ? 'Meuble' :
                          lease.lease_type === 'unfurnished' ? 'Non meuble' :
                          'Etudiant (Meuble)';

    const bailType = lease.lease_type === 'student' ? 'Bail etudiant (9 mois)' : 'Bail mobilite (1 a 10 mois)';
    const bailTypeShort = lease.lease_type === 'student' ? 'bail etudiant' : 'bail mobilite';

    const depositClause = lease.lease_type === 'furnished' && lease.security_deposit > 0
      ? `Un depot de garantie d'un montant de ${lease.security_deposit.toFixed(2)} EUR est verse a la signature du present contrat. Ce depot sera restitue dans un delai d'un mois apres la remise des cles, deduction faite, le cas echeant, des sommes dues au bailleur.`
      : 'En application de la loi, aucun depot de garantie ne peut etre exige pour un bail mobilite.';

    const houseRulesSection = listing.house_rules
      ? `<h3>C. Reglement interieur et regles d'usage</h3><p>Le locataire s'engage a respecter les regles suivantes :</p><ul>${listing.house_rules.split('\n').map((r: string) => `<li>${r}</li>`).join('')}</ul>`
      : '';

    const customClauses = lease.terms_and_conditions
      ? lease.terms_and_conditions.split('\n').map((c: string) => `<p>${c}</p>`).join('')
      : '<p>Aucune clause particuliere.</p>';

    const vars: Record<string, string> = {
      '{{landlord_name}}': `${landlord.first_name} ${landlord.last_name}`,
      '{{tenant_name}}': `${tenant.first_name} ${tenant.last_name}`,
      '{{tenant_phone}}': tenant.phone ? `<p><strong>Telephone :</strong> ${tenant.phone}</p>` : '',
      '{{listing_address}}': listing.address || '',
      '{{listing_title}}': listing.title || '',
      '{{start_date}}': startDate,
      '{{end_date}}': endDate,
      '{{duration_months}}': durationMonths,
      '{{monthly_rent}}': lease.monthly_rent.toFixed(2),
      '{{charges}}': lease.charges.toFixed(2),
      '{{total_monthly}}': (lease.monthly_rent + lease.charges).toFixed(2),
      '{{security_deposit}}': lease.security_deposit.toFixed(2),
      '{{lease_type_label}}': leaseTypeLabel,
      '{{bail_type}}': bailType,
      '{{bail_type_short}}': bailTypeShort,
      '{{deposit_clause}}': depositClause,
      '{{house_rules_section}}': houseRulesSection,
      '{{custom_clauses}}': customClauses,
      '{{today}}': today,
    };

    let html: string;

    if (templateSections && templateSections.length > 0 && !templateError) {
      // Use database template
      html = buildContractHTML(templateSections, vars);
    } else {
      // Fallback: generate basic contract if no template found
      const fallbackSections = [
        { content: `<h1>Contrat de Location</h1><div class="subtitle">${leaseTypeLabel} - Usage d'habitation</div>` },
        { content: `<h2>I. Designation des parties</h2><p><strong>Bailleur :</strong> ${vars['{{landlord_name}}']}</p><p><strong>Locataire :</strong> ${vars['{{tenant_name}}']}</p>` },
        { content: `<h2>II. Objet</h2><p><strong>Adresse :</strong> ${vars['{{listing_address}}']}</p><p>${vars['{{listing_title}}']}</p>` },
        { content: `<h2>III. Duree</h2><p>Du ${startDate} au ${endDate} (${durationMonths} mois)</p>` },
        { content: `<h2>IV. Loyer</h2><p>Loyer : ${vars['{{monthly_rent}}']} EUR | Charges : ${vars['{{charges}}']} EUR | Total : ${vars['{{total_monthly}}']} EUR</p>` },
      ];
      html = buildContractHTML(fallbackSections, vars);
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
