import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  feedId?: string;
  listingId?: string;
  feedUrl?: string;
  feedName?: string;
}

interface ICalEvent {
  uid: string;
  startDate: string;
  endDate: string;
  summary: string;
  description: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: RequestBody = await req.json();
    const { feedId, listingId, feedUrl, feedName } = body;

    let feed;
    if (feedId) {
      const { data, error } = await supabase
        .from('external_ical_feeds')
        .select('*')
        .eq('id', feedId)
        .maybeSingle();

      if (error || !data) {
        return new Response(JSON.stringify({ error: 'Feed not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      feed = data;
    } else if (listingId && feedUrl && feedName) {
      const { data: listing } = await supabase
        .from('listings')
        .select('landlord_id')
        .eq('id', listingId)
        .maybeSingle();

      if (!listing || listing.landlord_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase
        .from('external_ical_feeds')
        .insert({
          listing_id: listingId,
          feed_url: feedUrl,
          feed_name: feedName,
        })
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: 'Failed to create feed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      feed = data;
    } else {
      return new Response(JSON.stringify({ error: 'Invalid parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Fetching iCal from: ${feed.feed_url}`);
    const icalResponse = await fetch(feed.feed_url, {
      headers: {
        'User-Agent': 'HelloFonty-Calendar-Sync/1.0',
        'Accept': 'text/calendar, text/plain, */*',
      },
      redirect: 'follow',
    });

    if (!icalResponse.ok) {
      await supabase
        .from('external_ical_feeds')
        .update({
          sync_status: 'error',
          error_message: `HTTP ${icalResponse.status}: ${icalResponse.statusText}`,
        })
        .eq('id', feed.id);

      return new Response(
        JSON.stringify({
          error: `Failed to fetch calendar: ${icalResponse.status} ${icalResponse.statusText}`,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const icalContent = await icalResponse.text();
    console.log('iCal content length:', icalContent.length);

    if (!icalContent.includes('BEGIN:VCALENDAR')) {
      await supabase
        .from('external_ical_feeds')
        .update({
          sync_status: 'error',
          error_message: 'Invalid iCal format: missing VCALENDAR',
        })
        .eq('id', feed.id);

      return new Response(
        JSON.stringify({ error: 'The URL does not return a valid iCal calendar' }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const events = parseICalendar(icalContent);
    console.log(`Parsed ${events.length} events`);

    const { data: existingDates } = await supabase
      .from('imported_blocked_dates')
      .select('event_uid')
      .eq('feed_id', feed.id);

    const existingUids = new Set(
      (existingDates || []).map((d: { event_uid: string }) => d.event_uid)
    );
    const newUids = new Set(events.map((e) => e.uid));

    const toDelete = [...existingUids].filter((uid) => !newUids.has(uid));
    if (toDelete.length > 0) {
      await supabase
        .from('imported_blocked_dates')
        .delete()
        .in('event_uid', toDelete)
        .eq('feed_id', feed.id);
    }

    for (const event of events) {
      await supabase.from('imported_blocked_dates').upsert(
        {
          listing_id: feed.listing_id,
          feed_id: feed.id,
          start_date: event.startDate,
          end_date: event.endDate,
          event_uid: event.uid,
          summary: event.summary,
          description: event.description,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'event_uid',
        }
      );
    }

    await supabase
      .from('external_ical_feeds')
      .update({
        last_synced_at: new Date().toISOString(),
        sync_status: 'active',
        error_message: null,
      })
      .eq('id', feed.id);

    return new Response(
      JSON.stringify({
        success: true,
        eventsCount: events.length,
        feedId: feed.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error importing iCal:', error);
    return new Response(
      JSON.stringify({ error: `Internal server error: ${error.message}` }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function parseICalendar(icalContent: string): ICalEvent[] {
  const events: ICalEvent[] = [];

  const unfoldedContent = icalContent.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfoldedContent.split(/\r?\n/);

  let currentEvent: Partial<ICalEvent> | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      currentEvent = { summary: '', description: '' };
    } else if (line === 'END:VEVENT') {
      if (currentEvent && currentEvent.uid && currentEvent.startDate) {
        if (!currentEvent.endDate) {
          currentEvent.endDate = currentEvent.startDate;
        }
        events.push(currentEvent as ICalEvent);
      }
      currentEvent = null;
    } else if (currentEvent && line.includes(':')) {
      const colonIndex = line.indexOf(':');
      const propertyPart = line.substring(0, colonIndex);
      const value = line.substring(colonIndex + 1);
      const propName = propertyPart.split(';')[0].toUpperCase();

      switch (propName) {
        case 'UID':
          currentEvent.uid = value.trim();
          break;
        case 'DTSTART':
          currentEvent.startDate = parseICalDate(value);
          break;
        case 'DTEND':
          currentEvent.endDate = parseICalDate(value);
          break;
        case 'SUMMARY':
          currentEvent.summary = unescapeICalText(value);
          break;
        case 'DESCRIPTION':
          currentEvent.description = unescapeICalText(value);
          break;
      }
    }
  }

  return events;
}

function parseICalDate(dateStr: string): string {
  const cleaned = dateStr.replace(/[^0-9T]/g, '');

  if (cleaned.length >= 8) {
    const year = cleaned.substring(0, 4);
    const month = cleaned.substring(4, 6);
    const day = cleaned.substring(6, 8);
    return `${year}-${month}-${day}`;
  }

  return dateStr.trim();
}

function unescapeICalText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}
