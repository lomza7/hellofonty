import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SITE_URL = 'https://hellofonty.fr';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { lease_id, type } = await req.json();

    if (!lease_id || !type) {
      throw new Error('lease_id and type are required');
    }

    const { data: lease, error: leaseError } = await supabase
      .from('leases')
      .select('id, tenant_id, landlord_id, start_date, end_date, monthly_rent, charges, listing_id')
      .eq('id', lease_id)
      .maybeSingle();

    if (leaseError || !lease) {
      throw new Error('Lease not found');
    }

    const { data: listing } = await supabase
      .from('listings')
      .select('title, address')
      .eq('id', lease.listing_id)
      .maybeSingle();

    const { data: tenant } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', lease.tenant_id)
      .maybeSingle();

    const { data: landlord } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', lease.landlord_id)
      .maybeSingle();

    if (!tenant || !landlord) {
      throw new Error('Profiles not found');
    }

    const { data: tenantAuth } = await supabase.auth.admin.getUserById(lease.tenant_id);
    const tenantEmail = tenantAuth?.user?.email;

    const { data: landlordAuth } = await supabase.auth.admin.getUserById(lease.landlord_id);
    const landlordEmail = landlordAuth?.user?.email;

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const startDate = lease.start_date
      ? new Date(lease.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const endDate = lease.end_date
      ? new Date(lease.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';

    const totalMonthly = (parseFloat(lease.monthly_rent) + parseFloat(lease.charges)).toFixed(2);

    const leaseDetailsTable = `
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tr><td style="padding:8px 0;color:#6b7280;">Logement</td><td style="padding:8px 0;font-weight:600;">${listing?.title || ''}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;">Adresse</td><td style="padding:8px 0;font-weight:600;">${listing?.address || ''}</td></tr>
        ${startDate ? `<tr><td style="padding:8px 0;color:#6b7280;">Periode</td><td style="padding:8px 0;font-weight:600;">${startDate} — ${endDate}</td></tr>` : ''}
        <tr><td style="padding:8px 0;color:#6b7280;">Loyer hors charges</td><td style="padding:8px 0;font-weight:600;">${lease.monthly_rent} EUR</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;">Charges</td><td style="padding:8px 0;font-weight:600;">${lease.charges} EUR</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280;border-top:1px solid #e5e7eb;">Total mensuel</td><td style="padding:8px 0;font-weight:700;border-top:1px solid #e5e7eb;">${totalMonthly} EUR</td></tr>
      </table>
    `;

    const emailsSent: string[] = [];

    if (type === 'signature_request') {
      // Email to tenant
      if (tenantEmail) {
        const tenantHtml = buildEmail({
          title: 'Contrat de location a signer',
          greeting: `Bonjour ${tenant.first_name},`,
          body: `
            <p><strong>${landlord.first_name} ${landlord.last_name}</strong> vous a envoye un contrat de location pour signature.</p>
            ${leaseDetailsTable}
            <p>Veuillez vous connecter a votre espace pour consulter et signer le contrat.</p>
          `,
          ctaUrl: `${SITE_URL}/mes-baux`,
          ctaText: 'Voir et signer mon contrat',
          headerColor: '#0d9488',
        });

        await sendEmail(resendApiKey, {
          to: tenantEmail,
          subject: `Contrat de location a signer - ${listing?.title || 'Votre logement'}`,
          html: tenantHtml,
        });
        emailsSent.push(tenantEmail);
      }

      // Email to landlord (confirmation + copy)
      if (landlordEmail) {
        const landlordHtml = buildEmail({
          title: 'Confirmation d\'envoi de votre contrat',
          greeting: `Bonjour ${landlord.first_name},`,
          body: `
            <p>Votre contrat de location a bien ete signe de votre cote et envoye a <strong>${tenant.first_name} ${tenant.last_name}</strong> pour signature.</p>
            ${leaseDetailsTable}
            <p>Vous recevrez une notification lorsque le locataire aura signe le contrat. Vous pouvez aussi suivre l'avancement depuis votre espace.</p>
          `,
          ctaUrl: `${SITE_URL}/mes-baux`,
          ctaText: 'Voir mes contrats',
          headerColor: '#1e40af',
        });

        await sendEmail(resendApiKey, {
          to: landlordEmail,
          subject: `Contrat envoye pour signature - ${listing?.title || 'Votre logement'}`,
          html: landlordHtml,
        });
        emailsSent.push(landlordEmail);
      }
    } else if (type === 'signature_reminder') {
      // Reminder email to tenant only
      if (tenantEmail) {
        const tenantHtml = buildEmail({
          title: 'Rappel : Contrat de location a signer',
          greeting: `Bonjour ${tenant.first_name},`,
          body: `
            <p>Ceci est un rappel : <strong>${landlord.first_name} ${landlord.last_name}</strong> vous a envoye un contrat de location et attend toujours votre signature.</p>
            ${leaseDetailsTable}
            <p>Merci de vous connecter a votre espace pour consulter et signer le contrat des que possible.</p>
          `,
          ctaUrl: `${SITE_URL}/mes-baux`,
          ctaText: 'Voir et signer mon contrat',
          headerColor: '#0d9488',
        });

        await sendEmail(resendApiKey, {
          to: tenantEmail,
          subject: `Rappel : Contrat de location a signer - ${listing?.title || 'Votre logement'}`,
          html: tenantHtml,
        });
        emailsSent.push(tenantEmail);
      }
    } else if (type === 'tenant_signed') {
      // Email to landlord when tenant signs
      if (landlordEmail) {
        const landlordHtml = buildEmail({
          title: 'Contrat signe par le locataire',
          greeting: `Bonjour ${landlord.first_name},`,
          body: `
            <p><strong>${tenant.first_name} ${tenant.last_name}</strong> a signe votre contrat de location.</p>
            ${leaseDetailsTable}
            <p>Le contrat est maintenant effectif. Les deux parties ont signe. Vous pouvez telecharger le contrat signe depuis votre espace.</p>
          `,
          ctaUrl: `${SITE_URL}/mes-baux`,
          ctaText: 'Voir le contrat signe',
          headerColor: '#059669',
        });

        await sendEmail(resendApiKey, {
          to: landlordEmail,
          subject: `Contrat signe - ${listing?.title || 'Votre logement'}`,
          html: landlordHtml,
        });
        emailsSent.push(landlordEmail);
      }
    } else {
      throw new Error(`Unknown notification type: ${type}`);
    }

    return new Response(
      JSON.stringify({ success: true, emails_sent: emailsSent }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in send-lease-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function sendEmail(apiKey: string, params: { to: string; subject: string; html: string }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: 'HelloFonty <noreply@hellofonty.fr>',
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    console.error('Resend API error:', error);
  }
  return res;
}

interface EmailTemplate {
  title: string;
  greeting: string;
  body: string;
  ctaUrl: string;
  ctaText: string;
  headerColor: string;
}

function buildEmail(params: EmailTemplate): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background: ${params.headerColor}; color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 700;">${params.title}</h1>
    </div>
    <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
      <p style="margin: 0 0 16px 0;">${params.greeting}</p>
      ${params.body}
      <div style="text-align: center; margin: 30px 0 10px 0;">
        <a href="${params.ctaUrl}" style="display: inline-block; background: ${params.headerColor}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">${params.ctaText}</a>
      </div>
    </div>
    <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
      <p style="margin: 0;">HelloFonty — Votre partenaire logement a Fontainebleau</p>
      <p style="margin: 4px 0 0 0;">Cet email a ete envoye automatiquement, merci de ne pas y repondre.</p>
    </div>
  </div>
</body>
</html>`;
}
