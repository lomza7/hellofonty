import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Vérifier que l'appelant est connecté
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { success: false, error: "Non autorisé" });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json(401, { success: false, error: "Non autorisé" });

    // 2. Vérifier que l'appelant est le super-administrateur
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== "admin") {
      return json(403, {
        success: false,
        error: "Accès refusé. Seul le super-administrateur peut créer des comptes manager.",
      });
    }

    // 3. Lire et valider la demande
    const { email, first_name, last_name, phone, redirect_url } = await req.json();
    if (!email || !first_name || !last_name) {
      return json(400, { success: false, error: "Champs requis : email, first_name, last_name" });
    }

    // 4. Générer un lien d'invitation sans dépendre du SMTP de Supabase
    const { data: invite, error: inviteError } = await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: redirect_url ?? undefined,
        data: { first_name, last_name, role: "manager" },
      },
    });
    if (inviteError || !invite.user || !invite.properties?.action_link) {
      return json(400, { success: false, error: inviteError?.message ?? "Génération de l'invitation impossible" });
    }

    // 5. Créer ou mettre à jour le profil en 'manager'
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: invite.user.id,
      email,
      first_name,
      last_name,
      phone: phone ?? null,
      role: "manager",
    });
    if (profileError) {
      await supabase.auth.admin.deleteUser(invite.user.id);
      return json(400, { success: false, error: `Profil non créé : ${profileError.message}` });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      await supabase.auth.admin.deleteUser(invite.user.id);
      return json(500, { success: false, error: "Service d'email non configuré" });
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
        subject: "Votre invitation manager HelloFonty",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 32px;">
            <h1 style="color: #e11d48;">Bienvenue sur HelloFonty</h1>
            <p>Bonjour ${first_name} ${last_name},</p>
            <p>Vous êtes invité(e) à rejoindre HelloFonty en tant que manager.</p>
            <p style="text-align: center; margin: 32px 0;"><a href="${invite.properties.action_link}" style="background: #2563eb; color: #ffffff; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Créer mon mot de passe</a></p>
            <p>Ce lien vous permettra de choisir votre mot de passe et d'activer votre compte.</p>
            <p>Si vous n'êtes pas concerné(e), vous pouvez ignorer cet email.</p>
          </div>
        `,
      }),
    });

    if (!resendResponse.ok) {
      await supabase.auth.admin.deleteUser(invite.user.id);
      return json(502, { success: false, error: "L'email d'invitation n'a pas pu être envoyé" });
    }

    return json(200, { success: true, manager_id: invite.user.id });
  } catch (e) {
    return json(500, { success: false, error: e instanceof Error ? e.message : "Erreur inconnue" });
  }
});
