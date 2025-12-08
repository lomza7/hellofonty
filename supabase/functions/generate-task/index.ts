import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, taskType, relatedEntityType, relatedEntityId } = await req.json();

    if (!userId || !taskType) {
      return new Response(
        JSON.stringify({ error: "userId and taskType are required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    let taskData: any = {
      user_id: userId,
      task_type: 'system',
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
    };

    switch (taskType) {
      case 'NEW_BOOKING_REQUEST':
        const { data: booking } = await supabase
          .from('bookings')
          .select('*, listings(title)')
          .eq('id', relatedEntityId)
          .single();
        
        taskData = {
          ...taskData,
          title: 'Répondre à une nouvelle demande de réservation',
          description: `Une nouvelle demande de réservation pour ${booking?.listings?.title || 'votre logement'} nécessite votre attention.`,
          priority: 'urgent',
          due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };
        break;

      case 'UNREAD_MESSAGES':
        taskData = {
          ...taskData,
          title: 'Répondre aux messages non lus',
          description: 'Vous avez des messages en attente depuis plus de 24h.',
          priority: 'important',
        };
        break;

      case 'UPCOMING_PAYMENT':
        const { data: payment } = await supabase
          .from('rent_payments')
          .select('amount, due_date')
          .eq('id', relatedEntityId)
          .single();
        
        taskData = {
          ...taskData,
          title: 'Payer le loyer à venir',
          description: `Votre loyer de ${payment?.amount || 0}€ est à payer prochainement.`,
          priority: 'urgent',
          due_date: payment?.due_date,
        };
        break;

      case 'COMPLETE_PROFILE':
        taskData = {
          ...taskData,
          title: 'Compléter votre profil',
          description: 'Ajoutez une photo et vérifiez vos informations pour maximiser vos chances.',
          priority: 'normal',
        };
        break;

      case 'VERIFY_EMAIL':
        taskData = {
          ...taskData,
          title: 'Vérifier votre email INSEAD',
          description: 'Vérifiez votre adresse email pour accéder à toutes les fonctionnalités.',
          priority: 'important',
        };
        break;

      case 'CREATE_ACCESS_GUIDE':
        const { data: bookingForGuide } = await supabase
          .from('bookings')
          .select('*, listings(title)')
          .eq('id', relatedEntityId)
          .single();
        
        taskData = {
          ...taskData,
          title: 'Créer le guide d\'accès',
          description: `Créez un guide d'accès pour la réservation de ${bookingForGuide?.listings?.title || 'votre logement'}.`,
          priority: 'important',
          due_date: bookingForGuide?.start_date,
        };
        break;

      case 'SIGN_LEASE':
        taskData = {
          ...taskData,
          title: 'Signer le bail électronique',
          description: 'Votre bail est prêt à être signé.',
          priority: 'important',
        };
        break;

      case 'SCHEDULE_INVENTORY':
        taskData = {
          ...taskData,
          title: 'Planifier l\'état des lieux',
          description: 'Créez un état des lieux pour votre logement.',
          priority: 'important',
        };
        break;

      case 'ACCEPT_BOOKING':
        taskData = {
          ...taskData,
          title: 'Accepter ou refuser la demande',
          description: 'Une demande de réservation est en attente depuis plus de 24h.',
          priority: 'urgent',
        };
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Unknown task type" }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
    }

    const { data: existingTask } = await supabase
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('title', taskData.title)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingTask) {
      return new Response(
        JSON.stringify({ message: "Task already exists", task: existingTask }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .insert([taskData])
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, task }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err: any) {
    console.error('Error generating task:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});