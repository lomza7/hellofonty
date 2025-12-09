import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  to: string;
  firstName: string;
  lastName: string;
  isApproved: boolean;
  rejectionReason?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { to, firstName, lastName, isApproved, rejectionReason }: EmailRequest = await req.json();

    const subject = isApproved 
      ? "Votre compte HelloFonty a été approuvé ✓" 
      : "Mise à jour de votre demande de vérification";

    const htmlContent = isApproved 
      ? `
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
            .success-icon { font-size: 48px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Félicitations ${firstName}!</h1>
            </div>
            <div class="content">
              <div class="success-icon">✅</div>
              <h2>Votre compte a été vérifié et approuvé</h2>
              <p>Bonjour ${firstName} ${lastName},</p>
              <p>Excellente nouvelle ! Votre compte HelloFonty a été vérifié avec succès par notre équipe.</p>
              <p>Vous pouvez maintenant profiter de tous les avantages de la plateforme :</p>
              <ul>
                <li>✓ Badge "Identité vérifiée" sur votre profil</li>
                <li>✓ Accès prioritaire aux annonces</li>
                <li>✓ Confiance renforcée auprès des propriétaires</li>
              </ul>
              <p style="text-align: center;">
                <a href="${Deno.env.get('VITE_SUPABASE_URL')}" class="button">Accéder à mon compte</a>
              </p>
              <p>Merci de faire partie de la communauté HelloFonty !</p>
            </div>
            <div class="footer">
              <p>HelloFonty - Votre partenaire logement à Fontainebleau</p>
              <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            </div>
          </div>
        </body>
        </html>
      `
      : `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Mise à jour de votre demande</h1>
            </div>
            <div class="content">
              <p>Bonjour ${firstName} ${lastName},</p>
              <p>Nous avons examiné votre demande de vérification, mais nous ne pouvons pas l'approuver pour le moment.</p>
              ${rejectionReason ? `<p><strong>Raison :</strong> ${rejectionReason}</p>` : ''}
              <p>N'hésitez pas à soumettre une nouvelle demande avec un document mis à jour.</p>
              <p>Notre équipe reste à votre disposition pour toute question.</p>
            </div>
            <div class="footer">
              <p>HelloFonty - Votre partenaire logement à Fontainebleau</p>
            </div>
          </div>
        </body>
        </html>
      `;

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

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "HelloFonty <noreply@hellofonty.fr>",
        to: to,
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
        to,
        subject
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error sending email:', error);
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
