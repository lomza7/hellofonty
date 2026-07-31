import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const ADMIN_EMAIL = 'conciergerie@sweeps.fr';
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

    const { message_id } = await req.json();

    if (!message_id) {
      throw new Error('message_id is required');
    }

    const { data: message, error: msgError } = await supabase
      .from('messages')
      .select('id, sender_id, recipient_id, content, listing_id, created_at')
      .eq('id', message_id)
      .maybeSingle();

    if (msgError || !message) {
      throw new Error('Message not found');
    }

    // Don't notify for system messages (sender_id is null)
    if (!message.sender_id || !message.recipient_id) {
      return new Response(
        JSON.stringify({ success: true, skipped: 'system message' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: sender } = await supabase
      .from('profiles')
      .select('first_name, last_name, role')
      .eq('id', message.sender_id)
      .maybeSingle();

    const { data: recipient } = await supabase
      .from('profiles')
      .select('first_name, last_name, role')
      .eq('id', message.recipient_id)
      .maybeSingle();

    if (!sender || !recipient) {
      throw new Error('Profiles not found');
    }

    const { data: senderAuth } = await supabase.auth.admin.getUserById(message.sender_id);
    const senderEmail = senderAuth?.user?.email;

    const { data: recipientAuth } = await supabase.auth.admin.getUserById(message.recipient_id);
    const recipientEmail = recipientAuth?.user?.email;

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    let listingTitle: string | null = null;
    if (message.listing_id) {
      const { data: listing } = await supabase
        .from('listings')
        .select('title, address')
        .eq('id', message.listing_id)
        .maybeSingle();
      listingTitle = listing?.title ?? null;
    }

    const messagePreview = message.content.length > 200
      ? message.content.substring(0, 200) + '...'
      : message.content;

    const senderFullName = `${sender.first_name} ${sender.last_name}`;
    const recipientFullName = `${recipient.first_name} ${recipient.last_name}`;

    const emails: Array<{ to: string; subject: string; html: string }> = [];

    // 1. Email to the recipient
    if (recipientEmail) {
      emails.push({
        to: recipientEmail,
        subject: `Nouveau message de ${senderFullName}${listingTitle ? ` - ${listingTitle}` : ''}`,
        html: buildEmail({
          title: 'Nouveau message',
          greeting: `Bonjour ${recipient.first_name},`,
          body: `
            <p>Vous avez recu un nouveau message de <strong>${senderFullName}</strong>${listingTitle ? ` concernant le logement <strong>${listingTitle}</strong>` : ''}.</p>
            <div style="background:#f9fafb;border-left:4px solid #0ea5e9;padding:16px;margin:20px 0;border-radius:8px;">
              <p style="margin:0;color:#374151;font-style:italic;">"${messagePreview}"</p>
            </div>
            <p>Connectez-vous a votre espace pour repondre.</p>
          `,
          ctaUrl: `${SITE_URL}/messages`,
          ctaText: 'Voir le message',
          headerColor: '#0ea5e9',
        }),
      });
    }

    // 2. Email to the conciergerie (admin)
    emails.push({
      to: ADMIN_EMAIL,
      subject: `[Messagerie] ${senderFullName} → ${recipientFullName}${listingTitle ? ` - ${listingTitle}` : ''}`,
      html: buildEmail({
        title: 'Nouveau echange sur la messagerie',
        greeting: 'Bonjour,',
        body: `
          <p>Un nouveau message a ete envoye sur la plateforme.</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr><td style="padding:8px 0;color:#6b7280;">De</td><td style="padding:8px 0;font-weight:600;">${senderFullName} (${sender.role})${senderEmail ? ` - ${senderEmail}` : ''}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">A</td><td style="padding:8px 0;font-weight:600;">${recipientFullName} (${recipient.role})${recipientEmail ? ` - ${recipientEmail}` : ''}</td></tr>
            ${listingTitle ? `<tr><td style="padding:8px 0;color:#6b7280;">Logement</td><td style="padding:8px 0;font-weight:600;">${listingTitle}</td></tr>` : ''}
          </table>
          <div style="background:#f9fafb;border-left:4px solid #6366f1;padding:16px;margin:20px 0;border-radius:8px;">
            <p style="margin:0;color:#374151;font-style:italic;">"${messagePreview}"</p>
          </div>
        `,
        ctaUrl: `${SITE_URL}/admin`,
        ctaText: 'Voir le tableau admin',
        headerColor: '#6366f1',
      }),
    });

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

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in send-message-notification:', error);
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
      <p style="margin: 0;">HelloFonty — Votre partenaire logement a Fontainebleau</p>
      <p style="margin: 4px 0 0 0;">Cet email a ete envoye automatiquement, merci de ne pas y repondre.</p>
    </div>
  </div>
</body>
</html>`;
}
