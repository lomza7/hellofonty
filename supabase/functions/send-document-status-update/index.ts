import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface StatusUpdateRequest {
  studentId: string;
  documentType: string;
  status: 'approved' | 'rejected' | 'needs_correction';
  adminNote?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { studentId, documentType, status, adminNote }: StatusUpdateRequest = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: student } = await supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', studentId)
      .maybeSingle();

    if (!student) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Étudiant non trouvé",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Service d'email non configuré",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const documentTypeLabels: { [key: string]: string } = {
      'id_card': 'Carte d\'identité',
      'student_card': 'Carte étudiante',
      'proof_enrollment': 'Certificat de scolarité',
      'rib': 'RIB',
      'tax_notice': 'Avis d\'imposition',
      'proof_income': 'Justificatif de revenus',
      'residence_permit': 'Titre de séjour',
      'guarantor_id': 'Pièce d\'identité du garant',
      'guarantor_income': 'Justificatif de revenus du garant',
    };

    const documentLabel = documentTypeLabels[documentType] || documentType;

    let subject = '';
    let headerColor = '';
    let headerIcon = '';
    let statusText = '';
    let statusMessage = '';

    if (status === 'approved') {
      subject = `✅ Document approuvé : ${documentLabel}`;
      headerColor = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      headerIcon = '✅';
      statusText = 'Document approuvé';
      statusMessage = 'Félicitations ! Votre document a été vérifié et approuvé par notre équipe.';
    } else if (status === 'rejected') {
      subject = `❌ Document refusé : ${documentLabel}`;
      headerColor = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      headerIcon = '❌';
      statusText = 'Document refusé';
      statusMessage = 'Malheureusement, votre document n\'a pas pu être validé. Veuillez soumettre un nouveau document conforme.';
    } else {
      subject = `⚠️ Document à corriger : ${documentLabel}`;
      headerColor = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
      headerIcon = '⚠️';
      statusText = 'Document à corriger';
      statusMessage = 'Votre document nécessite quelques corrections. Merci de soumettre une nouvelle version.';
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${headerColor}; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
          .button { display: inline-block; background: #f43f5e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .info-box { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f43f5e; }
          .status-icon { font-size: 48px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="status-icon">${headerIcon}</div>
            <h1>${statusText}</h1>
          </div>
          <div class="content">
            <p>Bonjour ${student.first_name},</p>
            <p>${statusMessage}</p>
            <div class="info-box">
              <p><strong>Document concerné :</strong> ${documentLabel}</p>
              <p><strong>Statut :</strong> ${statusText}</p>
              ${adminNote ? `<p><strong>Note de l'administrateur :</strong></p><p>${adminNote}</p>` : ''}
            </div>
            ${status !== 'approved' ? '<p>Vous pouvez soumettre un nouveau document dans votre espace personnel.</p>' : '<p>Vous êtes un pas de plus près de la vérification complète de votre profil !</p>'}
            <p style="text-align: center;">
              <a href="${Deno.env.get('VITE_SUPABASE_URL')}/mes-documents" class="button">Accéder à mes documents</a>
            </p>
          </div>
          <div class="footer">
            <p>HelloFonty - Plateforme de location étudiante</p>
            <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "HelloFonty <noreply@mail.hellofonty.com>",
        to: student.email,
        subject: subject,
        html: htmlContent,
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      console.error("Resend API error:", errorData);

      return new Response(
        JSON.stringify({
          success: false,
          error: "Échec de l'envoi de l'email",
          details: errorData
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email envoyé avec succès',
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error sending status update:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
