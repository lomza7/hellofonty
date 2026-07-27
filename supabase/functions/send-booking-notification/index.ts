import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const ADMIN_EMAIL = 'admin@hellofonty.com';
const SITE_URL = 'https://hellofonty.fr';

interface BookingNotificationPayload {
  type: 'new_request' | 'confirmed' | 'cancelled';
  record: {
    id: string;
    listing_id: string;
    student_id: string;
    start_date: string;
    end_date: string;
    total_days: number;
    total_price: number;
    status: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload: BookingNotificationPayload = await req.json();
    const { type, record } = payload;

    const { data: listing } = await supabase
      .from('listings')
      .select('title, landlord_id, address, city')
      .eq('id', record.listing_id)
      .maybeSingle();

    if (!listing) {
      return new Response(JSON.stringify({ error: 'Listing not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: student } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', record.student_id)
      .maybeSingle();

    const { data: landlord } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', listing.landlord_id)
      .maybeSingle();

    if (!student || !landlord) {
      return new Response(JSON.stringify({ error: 'Profiles not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: studentAuth } = await supabase.auth.admin.getUserById(record.student_id);
    const { data: landlordAuth } = await supabase.auth.admin.getUserById(listing.landlord_id);

    const studentEmail = studentAuth?.user?.email;
    const landlordEmail = landlordAuth?.user?.email;

    const startDate = new Date(record.start_date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const endDate = new Date(record.end_date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emails: Array<{ to: string; subject: string; html: string }> = [];

    if (type === 'new_request') {
      if (landlordEmail) {
        emails.push({
          to: landlordEmail,
          subject: `Nouvelle demande de réservation - ${listing.title}`,
          html: buildEmail({
            title: 'Nouvelle demande de réservation',
            greeting: `Bonjour ${landlord.first_name},`,
            body: `
              <p><strong>${student.first_name} ${student.last_name}</strong> souhaite réserver votre logement <strong>${listing.title}</strong>.</p>
              <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                <tr><td style="padding:8px 0;color:#6b7280;">Période</td><td style="padding:8px 0;font-weight:600;">${startDate} — ${endDate}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;">Durée</td><td style="padding:8px 0;font-weight:600;">${record.total_days} jour${record.total_days > 1 ? 's' : ''}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;">Montant total</td><td style="padding:8px 0;font-weight:600;">${record.total_price.toFixed(0)} EUR</td></tr>
              </table>
              <p>Connectez-vous à votre espace pour accepter ou refuser cette demande.</p>
            `,
            ctaUrl: `${SITE_URL}/mes-reservations`,
            ctaText: 'Voir la demande',
            headerColor: '#0ea5e9',
          }),
        });
      }

      emails.push({
        to: ADMIN_EMAIL,
        subject: `[Admin] Nouvelle demande - ${student.first_name} ${student.last_name} → ${listing.title}`,
        html: buildEmail({
          title: 'Nouvelle demande de réservation',
          greeting: 'Bonjour,',
          body: `
            <p>Une nouvelle demande de réservation vient d'être créée sur la plateforme.</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;">
              <tr><td style="padding:8px 0;color:#6b7280;">Étudiant</td><td style="padding:8px 0;font-weight:600;">${student.first_name} ${student.last_name}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;">Logement</td><td style="padding:8px 0;font-weight:600;">${listing.title}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;">Propriétaire</td><td style="padding:8px 0;font-weight:600;">${landlord.first_name} ${landlord.last_name}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;">Période</td><td style="padding:8px 0;font-weight:600;">${startDate} — ${endDate}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;">Montant</td><td style="padding:8px 0;font-weight:600;">${record.total_price.toFixed(0)} EUR</td></tr>
            </table>
          `,
          ctaUrl: `${SITE_URL}/admin`,
          ctaText: 'Aller au tableau admin',
          headerColor: '#6366f1',
        }),
      });
    } else if (type === 'confirmed') {
      if (studentEmail) {
        emails.push({
          to: studentEmail,
          subject: `Votre réservation est confirmée - ${listing.title}`,
          html: buildEmail({
            title: 'Réservation confirmée !',
            greeting: `Bonjour ${student.first_name},`,
            body: `
              <p>Bonne nouvelle ! <strong>${landlord.first_name} ${landlord.last_name}</strong> a accepté votre demande de réservation pour <strong>${listing.title}</strong>.</p>
              <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                <tr><td style="padding:8px 0;color:#6b7280;">Période</td><td style="padding:8px 0;font-weight:600;">${startDate} — ${endDate}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;">Durée</td><td style="padding:8px 0;font-weight:600;">${record.total_days} jour${record.total_days > 1 ? 's' : ''}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;">Montant total</td><td style="padding:8px 0;font-weight:600;">${record.total_price.toFixed(0)} EUR</td></tr>
              </table>
              <p>Connectez-vous à votre espace pour procéder au paiement et finaliser votre réservation.</p>
            `,
            ctaUrl: `${SITE_URL}/mes-reservations-etudiant`,
            ctaText: 'Voir ma réservation',
            headerColor: '#16a34a',
          }),
        });
      }

      emails.push({
        to: ADMIN_EMAIL,
        subject: `[Admin] Réservation confirmée - ${listing.title}`,
        html: buildEmail({
          title: 'Réservation confirmée',
          greeting: 'Bonjour,',
          body: `
            <p>Une réservation vient d'être confirmée.</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;">
              <tr><td style="padding:8px 0;color:#6b7280;">Étudiant</td><td style="padding:8px 0;font-weight:600;">${student.first_name} ${student.last_name}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;">Logement</td><td style="padding:8px 0;font-weight:600;">${listing.title}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;">Propriétaire</td><td style="padding:8px 0;font-weight:600;">${landlord.first_name} ${landlord.last_name}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;">Période</td><td style="padding:8px 0;font-weight:600;">${startDate} — ${endDate}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;">Montant</td><td style="padding:8px 0;font-weight:600;">${record.total_price.toFixed(0)} EUR</td></tr>
            </table>
          `,
          ctaUrl: `${SITE_URL}/admin`,
          ctaText: 'Aller au tableau admin',
          headerColor: '#16a34a',
        }),
      });
    } else if (type === 'cancelled') {
      if (studentEmail) {
        emails.push({
          to: studentEmail,
          subject: `Votre demande de réservation a été refusée - ${listing.title}`,
          html: buildEmail({
            title: 'Demande refusée',
            greeting: `Bonjour ${student.first_name},`,
            body: `
              <p>Malheureusement, <strong>${landlord.first_name} ${landlord.last_name}</strong> n'a pas pu donner suite à votre demande de réservation pour <strong>${listing.title}</strong>.</p>
              <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                <tr><td style="padding:8px 0;color:#6b7280;">Période demandée</td><td style="padding:8px 0;font-weight:600;">${startDate} — ${endDate}</td></tr>
              </table>
              <p>N'hésitez pas à consulter d'autres logements disponibles sur la plateforme.</p>
            `,
            ctaUrl: `${SITE_URL}/recherche`,
            ctaText: 'Voir les logements disponibles',
            headerColor: '#dc2626',
          }),
        });
      }

      emails.push({
        to: ADMIN_EMAIL,
        subject: `[Admin] Réservation refusée - ${listing.title}`,
        html: buildEmail({
          title: 'Réservation refusée',
          greeting: 'Bonjour,',
          body: `
            <p>Une réservation vient d'être refusée.</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;">
              <tr><td style="padding:8px 0;color:#6b7280;">Étudiant</td><td style="padding:8px 0;font-weight:600;">${student.first_name} ${student.last_name}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;">Logement</td><td style="padding:8px 0;font-weight:600;">${listing.title}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;">Propriétaire</td><td style="padding:8px 0;font-weight:600;">${landlord.first_name} ${landlord.last_name}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;">Période</td><td style="padding:8px 0;font-weight:600;">${startDate} — ${endDate}</td></tr>
            </table>
          `,
          ctaUrl: `${SITE_URL}/admin`,
          ctaText: 'Aller au tableau admin',
          headerColor: '#dc2626',
        }),
      });
    }

    const results = [];
    for (const email of emails) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: 'HelloFonty <noreply@hellofonty.fr>',
          to: email.to,
          subject: email.subject,
          html: email.html,
        }),
      });

      const result = await res.json();
      results.push({ to: email.to, success: res.ok, result });

      if (!res.ok) {
        console.error(`Failed to send to ${email.to}:`, result);
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in send-booking-notification:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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
      <p style="margin: 0;">HelloFonty — Votre partenaire logement a Fontainebleau</p>
      <p style="margin: 4px 0 0 0;">Cet email a ete envoye automatiquement, merci de ne pas y repondre.</p>
    </div>
  </div>
</body>
</html>`;
}
