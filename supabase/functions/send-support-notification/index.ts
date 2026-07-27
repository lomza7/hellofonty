import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const ADMIN_EMAIL = 'conciergerie@sweeps.fr';
const SITE_URL = 'https://hellofonty.fr';

interface SupportNotificationPayload {
  type: 'new_message' | 'new_conversation';
  record: {
    id: string;
    conversation_id: string;
    sender_id: string;
    sender_type: string;
    message: string;
    created_at: string;
  };
}

function buildEmail(params: {
  title: string;
  greeting: string;
  body: string;
  ctaUrl: string;
  ctaText: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.07);overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#0ea5e9,#0284c7);padding:30px 40px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">${params.title}</h1>
        </td></tr>
        <tr><td style="padding:35px 40px;">
          <p style="color:#374151;font-size:16px;margin-bottom:20px;">${params.greeting}</p>
          ${params.body}
          <div style="text-align:center;margin:30px 0;">
            <a href="${params.ctaUrl}" style="display:inline-block;background-color:#0ea5e9;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">${params.ctaText}</a>
          </div>
        </td></tr>
        <tr><td style="padding:20px 40px;background-color:#f1f5f9;text-align:center;">
          <p style="color:#64748b;font-size:12px;margin:0;">HelloFonty - Support Client</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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

    const payload: SupportNotificationPayload = await req.json();
    const { type, record } = payload;

    // Only notify admin for user messages, not admin replies
    if (record.sender_type === 'admin') {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'admin message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get sender profile
    const { data: sender } = await supabase
      .from('profiles')
      .select('first_name, last_name, role')
      .eq('id', record.sender_id)
      .maybeSingle();

    const senderName = sender
      ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim()
      : 'Utilisateur inconnu';

    // Get sender email
    const { data: senderAuth } = await supabase.auth.admin.getUserById(record.sender_id);
    const senderEmail = senderAuth?.user?.email || 'non disponible';

    // Get conversation info
    const { data: conversation } = await supabase
      .from('support_conversations')
      .select('id, status, created_at')
      .eq('id', record.conversation_id)
      .maybeSingle();

    // Count messages in conversation
    const { count } = await supabase
      .from('support_messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', record.conversation_id);

    const messagePreview = record.message.length > 300
      ? record.message.substring(0, 300) + '...'
      : record.message;

    const isNewConversation = type === 'new_conversation' || (count && count <= 1);
    const subjectPrefix = isNewConversation ? 'Nouveau ticket support' : 'Nouveau message support';

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emailHtml = buildEmail({
      title: subjectPrefix,
      greeting: 'Bonjour,',
      body: `
        <p>Un client a envoye un message sur le support HelloFonty.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr><td style="padding:8px 0;color:#6b7280;width:120px;">Client</td><td style="padding:8px 0;font-weight:600;">${senderName}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Email</td><td style="padding:8px 0;">${senderEmail}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Messages</td><td style="padding:8px 0;">${count || 1} message${(count || 1) > 1 ? 's' : ''} dans la conversation</td></tr>
        </table>
        <div style="background-color:#f8fafc;border-left:4px solid #0ea5e9;padding:15px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
          <p style="color:#374151;margin:0;white-space:pre-wrap;font-size:14px;line-height:1.6;">${messagePreview}</p>
        </div>
        <p style="color:#6b7280;font-size:13px;">Repondez depuis l'espace admin du support.</p>
      `,
      ctaUrl: `${SITE_URL}/admin/support`,
      ctaText: 'Voir le support',
    });

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'HelloFonty <noreply@hellofonty.fr>',
        to: ADMIN_EMAIL,
        subject: `[Support] ${subjectPrefix} - ${senderName}`,
        html: emailHtml,
      }),
    });

    const emailResult = await emailResponse.json();

    return new Response(
      JSON.stringify({ success: true, result: emailResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
