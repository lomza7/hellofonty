import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotificationRequest {
  studentId: string;
  documentType: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { studentId, documentType }: NotificationRequest = await req.json();

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

    const { data: admins } = await supabase
      .from('profiles')
      .select('email')
      .eq('is_admin', true);

    if (!admins || admins.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Aucun admin trouvé",
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

    const adminEmails = admins.map(admin => admin.email);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
          .button { display: inline-block; background: #f43f5e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          .info-box { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📄 Nouveau document reçu</h1>
          </div>
          <div class="content">
            <p>Bonjour,</p>
            <p>Un étudiant vient de soumettre un document à vérifier.</p>
            <div class="info-box">
              <p><strong>Étudiant :</strong> ${student.first_name} ${student.last_name}</p>
              <p><strong>Email :</strong> ${student.email}</p>
              <p><strong>Document :</strong> ${documentLabel}</p>
            </div>
            <p>Merci de vérifier ce document dans votre espace admin.</p>
            <p style="text-align: center;">
              <a href="${Deno.env.get('VITE_SUPABASE_URL')}/admin" class="button">Accéder à l'admin</a>
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
        from: "HelloFonty Admin <noreply@mail.hellofonty.com>",
        to: adminEmails,
        subject: `Nouveau document: ${documentLabel} - ${student.first_name} ${student.last_name}`,
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
    console.error('Error sending notification:', error);
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
