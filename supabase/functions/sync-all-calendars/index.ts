import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: feeds, error: feedsError } = await supabase
      .from('external_ical_feeds')
      .select('*')
      .eq('sync_status', 'active');

    if (feedsError) {
      console.error('Error fetching feeds:', feedsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch feeds' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const results = [];
    for (const feed of feeds || []) {
      try {
        console.log(`Syncing feed ${feed.id}: ${feed.feed_name}`);
        const result = await syncFeed(supabase, feed);
        results.push({
          feedId: feed.id,
          feedName: feed.feed_name,
          success: true,
          eventsCount: result.eventsCount,
        });
      } catch (error) {
        console.error(`Error syncing feed ${feed.id}:`, error);
        results.push({
          feedId: feed.id,
          feedName: feed.feed_name,
          success: false,
          error: error.message,
        });

        await supabase
          .from('external_ical_feeds')
          .update({
            sync_status: 'error',
            error_message: error.message,
          })
          .eq('id', feed.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        feedsSynced: results.length,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in sync-all-calendars:', error);
    return new Response(
      JSON.stringify({ error: `Internal server error: ${error.message}` }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function syncFeed(
  supabase: any,
  feed: any
): Promise<{ eventsCount: number }> {
  console.log(`Fetching iCal from: ${feed.feed_url}`);
  const icalResponse = await fetch(feed.feed_url, {
    headers: {
      'User-Agent': 'HelloFonty-Calendar-Sync/1.0',
    },
  });

  if (!icalResponse.ok) {
    throw new Error(`HTTP ${icalResponse.status}: ${icalResponse.statusText}`);
  }

  const icalContent = await icalResponse.text();
  const events = parseICalendar(icalContent);
  console.log(`Parsed ${events.length} events for feed ${feed.id}`);

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
    console.log(`Deleting ${toDelete.length} obsolete events`);
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

  return { eventsCount: events.length };
}

function parseICalendar(icalContent: string): ICalEvent[] {
  const events: ICalEvent[] = [];
  const lines = icalContent.split(/\r?\n/);
  let currentEvent: Partial<ICalEvent> | null = null;
  let currentProperty = '';
  let currentValue = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (line.startsWith(' ') || line.startsWith('\t')) {
      currentValue += line.substring(1);
      continue;
    }

    if (currentProperty && currentValue) {
      processProperty(currentEvent, currentProperty, currentValue);
    }

    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT' && currentEvent) {
      if (currentEvent.uid && currentEvent.startDate && currentEvent.endDate) {
        events.push(currentEvent as ICalEvent);
      }
      currentEvent = null;
    } else if (currentEvent && line.includes(':')) {
      const colonIndex = line.indexOf(':');
      currentProperty = line.substring(0, colonIndex);
      currentValue = line.substring(colonIndex + 1);
    } else {
      currentProperty = '';
      currentValue = '';
    }
  }

  return events;
}

function processProperty(
  event: Partial<ICalEvent> | null,
  property: string,
  value: string
): void {
  if (!event) return;

  const [propName] = property.split(';');

  switch (propName) {
    case 'UID':
      event.uid = value;
      break;
    case 'DTSTART':
      event.startDate = parseICalDate(value);
      break;
    case 'DTEND':
      event.endDate = parseICalDate(value);
      break;
    case 'SUMMARY':
      event.summary = unescapeICalText(value);
      break;
    case 'DESCRIPTION':
      event.description = unescapeICalText(value);
      break;
  }
}

function parseICalDate(dateStr: string): string {
  dateStr = dateStr.replace(/[^0-9]/g, '');

  if (dateStr.length >= 8) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}-${month}-${day}`;
  }

  return dateStr;
}

function unescapeICalText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}