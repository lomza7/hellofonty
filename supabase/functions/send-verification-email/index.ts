import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: "Email requis" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check rate limiting (max 5 attempts per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: attempts } = await supabase
      .from("email_verification_attempts")
      .select("id")
      .eq("email", email)
      .gt("attempted_at", oneHourAgo);

    if (attempts && attempts.length >= 5) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Trop de tentatives. Réessayez dans 1 heure.",
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store code with 15-minute expiration
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await supabase.from("email_verification_codes").insert({
      email,
      code,
      expires_at: expiresAt,
      used: false,
    });

    // Record attempt for rate limiting
    await supabase.from("email_verification_attempts").insert({
      email,
    });

    // Send email using Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Service d'email non configuré. Contactez l'administrateur.",
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
        to: email,
        subject: "Votre code de vérification HelloFonty",
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #fff5f7 0%, #e0f2fe 100%); border-radius: 16px; padding: 40px; text-align: center;">
                <h1 style="color: #e11d48; margin: 0 0 20px 0; font-size: 28px; font-weight: 700;">HelloFonty</h1>
                <h2 style="color: #1f2937; margin: 0 0 30px 0; font-size: 24px; font-weight: 600;">Vérification de votre email</h2>
                
                <p style="color: #4b5563; font-size: 16px; margin: 0 0 30px 0;">
                  Bienvenue sur HelloFonty ! Pour finaliser votre inscription, veuillez utiliser le code de vérification ci-dessous :
                </p>
                
                <div style="background-color: #ffffff; border: 3px solid #e11d48; border-radius: 12px; padding: 30px; margin: 30px 0;">
                  <div style="font-size: 48px; font-weight: 900; letter-spacing: 12px; color: #e11d48; font-family: 'Courier New', monospace;">
                    ${code}
                  </div>
                </div>
                
                <p style="color: #6b7280; font-size: 14px; margin: 20px 0 0 0;">
                  Ce code expire dans <strong>15 minutes</strong>.
                </p>
                
                <div style="margin-top: 40px; padding-top: 30px; border-top: 2px solid #e5e7eb;">
                  <p style="color: #9ca3af; font-size: 13px; margin: 0;">
                    Si vous n'avez pas demandé ce code, vous pouvez ignorer cet email en toute sécurité.
                  </p>
                  <p style="color: #9ca3af; font-size: 13px; margin: 10px 0 0 0;">
                    © 2024 HelloFonty - Plateforme de location étudiante à Fontainebleau
                  </p>
                </div>
              </div>
            </body>
          </html>
        `,
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      console.error("Resend API error:", errorData);
      
      // Return detailed error message
      let errorMessage = "Échec de l'envoi de l'email.";
      if (errorData.message) {
        errorMessage += ` Erreur Resend: ${errorData.message}`;
      }
      if (errorData.name === 'validation_error') {
        errorMessage = "Erreur de configuration Resend. Vérifiez votre domaine d'envoi.";
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
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
        message: "Code envoyé par email avec succès",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Erreur lors de l'envoi du code",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
