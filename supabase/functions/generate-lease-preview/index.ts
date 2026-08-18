import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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
    .map((s) => `<div class="section">${replaceVariables(s.content, vars)}</div>`)
    .join("\n");

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aperçu du Contrat de Location - Modèle HelloFonty</title>
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
    .preview-banner { background: #fef3c7; border: 2px solid #f59e0b; padding: 12px 20px; border-radius: 10px; margin-bottom: 30px; text-align: center; font-weight: 600; color: #92400e; font-size: 10pt; }
  </style>
</head>
<body>
<div class="preview-banner">
  APERCU - Ceci est un exemple du modele de bail HelloFonty avec des donnees fictives. Le contrat reel sera rempli automatiquement avec les informations de votre reservation.
</div>
${bodyContent}

<div class="page-break"></div>
<div class="signature-grid">
  <div class="sig-column">
    <div class="sig-name">Jean Dupont</div>
    <div class="sig-line"></div>
    <div class="sig-role">Le BAILLEUR ou son MANDATAIRE</div>
    <div class="sig-date">Fait le 1 septembre 2026</div>
  </div>
  <div class="sig-column">
    <div class="sig-name">Marie Martin</div>
    <div class="sig-line"></div>
    <div class="sig-role">Le(s) LOCATAIRE(S)</div>
    <div class="sig-date">Fait le 1 septembre 2026</div>
  </div>
</div>

<div class="footer">
  <p><strong>HelloFonty - Plateforme de Mise en Relation</strong></p>
  <p>Document genere le ${new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
</div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error("Invalid token");
    }

    const url = new URL(req.url);
    const lang = url.searchParams.get("lang") === "en" ? "en" : "fr";

    // Fetch template sections from database (filtered by language)
    const { data: templateSections, error: templateError } = await supabase
      .from("contract_template_sections")
      .select("*")
      .eq("is_active", true)
      .eq("language", lang)
      .order("display_order", { ascending: true });

    // Fictitious data for preview (5 months, under 8-month limit)
    const startDate = "1 septembre 2026";
    const endDate = "31 janvier 2027";
    const today = new Date().toLocaleDateString("fr-FR");
    const durationMonths = "5";

    const vars: Record<string, string> = {
      "{{landlord_name}}": "Jean Dupont",
      "{{landlord_address}}": "12 rue de Fontainebleau, 77300 Fontainebleau, France",
      "{{landlord_email}}": "jean.dupont@example.com",
      "{{tenant_name}}": "Marie Martin",
      "{{tenant_phone}}": "<p><strong>Téléphone :</strong> 06 12 34 56 78</p>",
      "{{tenant_email}}": "marie.martin@example.com",
      "{{tenant_permanent_address}}": "25 avenue des Champs-Élysées, 75008 Paris, France",
      "{{listing_address}}": "12 rue de Fontainebleau, 77300 Fontainebleau",
      "{{listing_title}}": "Appartement T2 meublé proche INSEAD",
      "{{start_date}}": startDate,
      "{{end_date}}": endDate,
      "{{duration_months}}": durationMonths,
      "{{monthly_rent}}": "800.00",
      "{{charges}}": "100.00",
      "{{total_monthly}}": "900.00",
      "{{security_deposit}}": "800.00",
      "{{deposit_clause}}": "Un dépôt de garantie d'un montant de 800.00 EUR est versé à la signature du présent contrat. Ce dépôt sera restitué dans un délai d'un mois après la remise des clés, déduction faite, le cas échéant, des sommes dues au bailleur.",
      "{{house_rules_section}}": "<h3>C. Règlement intérieur et règles d'usage</h3><p>Le locataire s'engage à respecter les règles suivantes :</p><ul><li>Pas de fêtes bruyantes après 22h</li><li>Animaux de compagnie non autorisés</li><li>Fumeur interdit dans le logement</li></ul>",
      "{{custom_clauses}}": "<p>Le locataire s'engage à souscrire une assurance habitation couvrant les risques locatifs. Une attestation devra être fournie au bailleur avant l'entrée dans les lieux.</p>",
      "{{today}}": today,
    };

    let html: string;

    if (templateSections && templateSections.length > 0 && !templateError) {
      html = buildContractHTML(templateSections, vars);
    } else {
      const fallbackSections = [
        { content: `<h1>Contrat de Location</h1><div class="subtitle">Meublé - Usage d'habitation</div>` },
        { content: `<h2>I. Désignation des parties</h2><p><strong>Bailleur :</strong> Jean Dupont</p><p><strong>Locataire :</strong> Marie Martin</p>` },
        { content: `<h2>II. Objet</h2><p><strong>Adresse :</strong> 12 rue de Fontainebleau, 77300 Fontainebleau</p><p>Appartement T2 meublé proche INSEAD</p>` },
        { content: `<h2>III. Durée</h2><p>Du ${startDate} au ${endDate} (${durationMonths} mois)</p>` },
        { content: `<h2>IV. Loyer</h2><p>Loyer : 800.00 EUR | Charges : 100.00 EUR | Total : 900.00 EUR</p>` },
      ];
      html = buildContractHTML(fallbackSections, vars);
    }

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
