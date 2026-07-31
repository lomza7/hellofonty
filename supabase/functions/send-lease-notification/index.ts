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
      .select('id, tenant_id, landlord_id, start_date, end_date, monthly_rent, listing_id')
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

    if (!tenantEmail) {
      throw new Error('Tenant email not found');
    }

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

    let subject = '';
    let html = '';

    if (type === 'signature_request') {
      subject = `Contrat de location à signer - ${listing?.title || 'Votre logement'}`;
      html = buildEmail({
        title: 'Contrat de location à signer',
        greeting: `Bonjour ${tenant.first_name},`,
        body: `
          <p><strong>${landlord.first_name} ${landlord.last_name}</strong> vous a envoyé un contrat de location pour signature.</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr><td style="padding:8px 0;color:#6b7280;">Logement</td><td style="padding:8px 0;font-weight:600;">${listing?.title || ''}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Adresse</td><td style="padding:8px 0;font-weight:600;">${listing?.address || ''}</td></tr>
            ${startDate ? `<tr><td style="padding:8px 0;color:#6b7280;">Période</td><td style="padding:8px 0;font-weight:600;">${startDate} — ${endDate}</td></tr>` : ''}
            ${lease.monthly_rent ? `<tr><td style="padding:8px 0;color:#6b7280;">Loyer mensuel</td><td style="padding:8px 0;font-weight:600;">${lease.monthly_rent} EUR</td></tr>` : ''}
          </table>
          <p>Veuillez vous connecter à votre espace pour consulter et signer le contrat.</p>
        `,
        ctaUrl: `${SITE_URL}/mes-baux`,
        ctaText: 'Voir et signer mon contrat',
        headerColor: '#0d9488',
      });
    } else {
      throw new Error(`Unknown notification type: ${type}`);
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'HelloFonty <noreply@hellofonty.fr>',
        to: tenantEmail,
        subject,
        html,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', result);
      throw new Error('Failed to send email');
    }

    return new Response(
      JSON.stringify({ success: true, to: tenantEmail }),
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
      <p style="margin: 0;">HelloFonty — Votre partenaire logement à Fontainebleau</p>
      <p style="margin: 4px 0 0 0;">Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
    </div>
  </div>
</body>
</html>`;
}
