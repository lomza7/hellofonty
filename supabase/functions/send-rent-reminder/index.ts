import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const paymentId = body.payment_id as string | undefined;
    const isManual = !!paymentId;

    // Check global setting (skip for manual reminders)
    if (!isManual) {
      const { data: settings } = await supabase
        .from("rent_reminder_settings")
        .select("auto_reminder_enabled")
        .eq("id", 1)
        .maybeSingle();

      if (settings && !settings.auto_reminder_enabled) {
        return new Response(
          JSON.stringify({ message: "Relance automatique désactivée", sent: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Build query for pending rent payments
    let query = supabase
      .from("rent_payments")
      .select(`
        id, booking_id, student_id, landlord_id, rent_amount, platform_fee,
        total_amount, payment_date, month_year, status, last_reminder_sent_at,
        auto_reminder_enabled,
        student:profiles!student_id(first_name, last_name),
        landlord:profiles!landlord_id(first_name, last_name),
        booking:bookings!booking_id(listing_id, start_date, end_date, auto_reminder_enabled, listing:listings!listing_id(title, city, address))
      `)
      .eq("status", "pending");

    if (isManual) {
      query = query.eq("id", paymentId);
    } else {
      // Auto: only those with auto_reminder_enabled and not reminded in last 24h
      query = query.eq("auto_reminder_enabled", true);
      // payment_date within 2 days or already passed
      const today = new Date();
      const twoDaysLater = new Date(today);
      twoDaysLater.setDate(twoDaysLater.getDate() + 2);
      query = query.lte("payment_date", twoDaysLater.toISOString().split("T")[0]);
      // Not reminded in last 24h
      query = query.or(`last_reminder_sent_at.is.null,last_reminder_sent_at.lt.${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}`);
    }

    const { data: payments, error } = await query;
    if (error) throw error;

    const paymentsList = (payments || []) as any[];
    let sentCount = 0;
    let overdueCount = 0;

    for (const payment of paymentsList) {
      // Skip if booking-level auto reminder is disabled (for auto mode only)
      if (!isManual && payment.booking && !payment.booking.auto_reminder_enabled) {
        continue;
      }

      const student = payment.student;
      const landlord = payment.landlord;
      const listing = payment.booking?.listing;
      const studentName = student ? `${student.first_name} ${student.last_name}` : "Étudiant";
      const listingTitle = listing?.title || "Logement";

      // Get student email
      const { data: studentAuth } = await supabase.auth.admin.getUserById(payment.student_id);
      const studentEmail = studentAuth?.user?.email;

      if (!studentEmail) continue;

      const paymentDate = new Date(payment.payment_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isOverdue = paymentDate < today;

      // Send email via Resend
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        const subject = isOverdue
          ? `Relance : votre loyer de ${payment.month_year} est en retard`
          : `Rappel : votre loyer de ${payment.month_year} arrive à échéance`;

        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #e11d48;">Bonjour ${studentName},</h2>
            <p>${isOverdue
              ? `Votre loyer pour <strong>${listingTitle}</strong> pour le mois de <strong>${payment.month_year}</strong> est en retard.`
              : `Votre loyer pour <strong>${listingTitle}</strong> pour le mois de <strong>${payment.month_year}</strong> arrive à échéance le <strong>${paymentDate.toLocaleDateString("fr-FR")}</strong>.`
            }</p>
            <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 4px 0;"><strong>Logement :</strong> ${listingTitle}</p>
              <p style="margin: 4px 0;"><strong>Mois :</strong> ${payment.month_year}</p>
              <p style="margin: 4px 0;"><strong>Montant du loyer :</strong> ${Number(payment.rent_amount).toFixed(2)} €</p>
              <p style="margin: 4px 0;"><strong>Frais de plateforme :</strong> ${Number(payment.platform_fee).toFixed(2)} €</p>
              <p style="margin: 4px 0; font-size: 18px;"><strong>Total à payer :</strong> ${Number(payment.total_amount).toFixed(2)} €</p>
            </div>
            <p>Merci de régulariser votre paiement dès que possible en vous connectant à votre espace étudiant.</p>
            <p style="color: #64748b; font-size: 14px; margin-top: 30px;">Ceci est un message automatique de Flat'inbleau.</p>
          </div>
        `;

        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: "Flat'inbleau <noreply@resend.dev>",
              to: [studentEmail],
              subject,
              html,
            }),
          });
          sentCount++;
        } catch (e) {
          console.error("Email send error:", e);
        }
      }

      // Create notification
      const notifType = isOverdue ? "rent_overdue" : "rent_reminder";
      const notifTitle = isOverdue ? "Loyer en retard" : "Rappel de loyer";
      const notifMessage = isOverdue
        ? `Votre loyer de ${payment.month_year} pour ${listingTitle} est en retard (${Number(payment.total_amount).toFixed(2)} €)`
        : `Votre loyer de ${payment.month_year} pour ${listingTitle} arrive à échéance (${Number(payment.total_amount).toFixed(2)} €)`;

      await supabase.from("notifications").insert({
        user_id: payment.student_id,
        type: notifType,
        title: notifTitle,
        message: notifMessage,
        link: "myMonthlyRents",
        related_id: payment.id,
      });

      // Update payment: set last_reminder_sent_at, and status to overdue if applicable
      const updateData: any = { last_reminder_sent_at: new Date().toISOString() };
      if (isOverdue) {
        updateData.status = "overdue";
        overdueCount++;
      }

      await supabase
        .from("rent_payments")
        .update(updateData)
        .eq("id", payment.id);
    }

    return new Response(
      JSON.stringify({
        message: isManual
          ? `Relance manuelle envoyée`
          : `Relances automatiques traitées`,
        sent: sentCount,
        overdue: overdueCount,
        total: paymentsList.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
