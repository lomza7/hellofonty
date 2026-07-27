import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface BlockedDate {
  start_date: string;
  end_date: string;
  id: string;
}

interface ImportedBlockedDate {
  start_date: string;
  end_date: string;
  event_uid: string;
  summary: string | null;
  description: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response('Missing token parameter', {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: tokenData, error: tokenError } = await supabase
      .from('ical_sync_tokens')
      .select('listing_id')
      .eq('token', token)
      .maybeSingle();

    if (tokenError || !tokenData) {
      return new Response('Invalid token', {
        status: 404,
        headers: corsHeaders,
      });
    }

    const listingId = tokenData.listing_id;

    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('title, address, city')
      .eq('id', listingId)
      .maybeSingle();

    if (listingError || !listing) {
      return new Response('Listing not found', {
        status: 404,
        headers: corsHeaders,
      });
    }

    const { data: blockedDates } = await supabase
      .from('blocked_dates')
      .select('start_date, end_date, id')
      .eq('listing_id', listingId);

    const { data: importedDates } = await supabase
      .from('imported_blocked_dates')
      .select('start_date, end_date, event_uid, summary, description')
      .eq('listing_id', listingId);

    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, start_date, end_date, status')
      .eq('listing_id', listingId)
      .in('status', ['confirmed']);

    const allBlockedDates = [
      ...(blockedDates || []).map((d: BlockedDate) => ({
        start: d.start_date,
        end: d.end_date,
        uid: `blocked-${d.id}@hellofonty.com`,
        summary: 'Non disponible',
        description: 'Date bloquée',
      })),
      ...(importedDates || []).map((d: ImportedBlockedDate) => ({
        start: d.start_date,
        end: d.end_date,
        uid: d.event_uid,
        summary: d.summary || 'Réservé',
        description: d.description || 'Réservation externe',
      })),
      ...(bookings || []).map((b: any) => ({
        start: b.start_date,
        end: b.end_date,
        uid: `booking-${b.id}@hellofonty.com`,
        summary: 'Réservé',
        description: b.status === 'confirmed' ? 'Réservation confirmée' : 'Réservation en attente',
      })),
    ];

    await supabase
      .from('ical_sync_tokens')
      .update({
        last_accessed_at: new Date().toISOString(),
      })
      .eq('token', token);

    const ical = generateICalendar(listing, allBlockedDates);

    return new Response(ical, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error generating iCal:', error);
    return new Response(`Internal server error: ${error.message}`, {
      status: 500,
      headers: corsHeaders,
    });
  }
});

function generateICalendar(
  listing: { title: string; address: string; city: string },
  blockedDates: Array<{
    start: string;
    end: string;
    uid: string;
    summary: string;
    description: string;
  }>
): string {
  const now = new Date();
  const timestamp = formatDateTime(now);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HelloFonty//iCal Sync//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICalText(listing.title)}`,
    `X-WR-CALDESC:Calendrier de disponibilite pour ${escapeICalText(listing.title)}`,
    'X-WR-TIMEZONE:Europe/Paris',
  ];

  for (const date of blockedDates) {
    const startDate = new Date(date.start + 'T00:00:00Z');
    const endDate = new Date(date.end + 'T00:00:00Z');
    endDate.setUTCDate(endDate.getUTCDate() + 1);

    lines.push(
      'BEGIN:VEVENT',
      `UID:${date.uid}`,
      `DTSTAMP:${timestamp}`,
      `DTSTART;VALUE=DATE:${formatDate(startDate)}`,
      `DTEND;VALUE=DATE:${formatDate(endDate)}`,
      `SUMMARY:${escapeICalText(date.summary)}`,
      `DESCRIPTION:${escapeICalText(date.description)}`,
      `LOCATION:${escapeICalText(`${listing.address}, ${listing.city}`)}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
