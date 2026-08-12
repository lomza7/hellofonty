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
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return json(403, {
        success: false,
        error: "Accès refusé. Seul le super-administrateur peut créer des comptes manager.",
      });
    }

    // 3. Lire et valider la demande
    const { email, password, first_name, last_name, phone } = await req.json();
    if (!email || !password || !first_name || !last_name) {
      return json(400, { success: false, error: "Champs requis : email, password, first_name, last_name" });
    }
    if (password.length < 8) {
      return json(400, { success: false, error: "Le mot de passe doit faire au moins 8 caractères" });
    }

    // 4. Créer le compte (email confirmé d'office : c'est l'admin qui le crée)
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name, last_name, role: "manager" },
    });
    if (createError || !created.user) {
      return json(400, { success: false, error: createError?.message ?? "Création du compte impossible" });
    }

    // 5. Créer ou mettre à jour le profil en 'manager'
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: created.user.id,
      email,
      first_name,
      last_name,
      phone: phone ?? null,
      role: "manager",
    });
    if (profileError) {
      // rollback : ne pas laisser un compte auth orphelin
      await supabase.auth.admin.deleteUser(created.user.id);
      return json(400, { success: false, error: `Profil non créé : ${profileError.message}` });
    }

    return json(200, { success: true, manager_id: created.user.id });
  } catch (e) {
    return json(500, { success: false, error: e instanceof Error ? e.message : "Erreur inconnue" });
  }
});
