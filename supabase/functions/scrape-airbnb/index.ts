import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AirbnbData {
  title: string;
  description: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  images: string[];
  amenities: string[];
  bonusFeatures?: string[];
  address: string;
  latitude?: number;
  longitude?: number;
  propertyType?: string;
  apartmentArea?: number;
  hasElevator?: boolean;
  furnished?: string;
  floor?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url || !url.includes('airbnb')) {
      return jsonError("URL Airbnb invalide", 400);
    }

    const listingIdMatch = url.match(/\/rooms\/(\d+)/);
    if (!listingIdMatch) {
      return jsonError("Impossible d'extraire l'ID de l'annonce", 400);
    }

    const listingId = listingIdMatch[1];
    console.log(`Fetching Airbnb listing: ${url} (ID: ${listingId})`);

    let html = "";
    let fetchErrors: string[] = [];

    // --- Strategy 1: Direct fetch ---
    try {
      html = await fetchPageDirect(url);
      console.log('Strategy 1 (direct) succeeded, html length:', html.length);
    } catch (e) {
      console.log('Strategy 1 (direct) failed:', e.message);
      fetchErrors.push(`direct: ${e.message}`);
    }

    // --- Strategy 2: allorigins proxy ---
    if (!html || html.length < 500) {
      try {
        html = await fetchViaProxy(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, 'allorigins');
        console.log('Strategy 2 (allorigins) succeeded, html length:', html.length);
      } catch (e) {
        console.log('Strategy 2 (allorigins) failed:', e.message);
        fetchErrors.push(`allorigins: ${e.message}`);
      }
    }

    // --- Strategy 3: corsproxy.io ---
    if (!html || html.length < 500) {
      try {
        html = await fetchViaProxy(`https://corsproxy.io/?url=${encodeURIComponent(url)}`, 'corsproxy');
        console.log('Strategy 3 (corsproxy) succeeded, html length:', html.length);
      } catch (e) {
        console.log('Strategy 3 (corsproxy) failed:', e.message);
        fetchErrors.push(`corsproxy: ${e.message}`);
      }
    }

    // --- Strategy 4: r.jina.ai (reader proxy, renders JS) ---
    if (!html || html.length < 500) {
      try {
        html = await fetchViaProxy(`https://r.jina.ai/${url}`, 'jina');
        console.log('Strategy 4 (jina) succeeded, html length:', html.length);
      } catch (e) {
        console.log('Strategy 4 (jina) failed:', e.message);
        fetchErrors.push(`jina: ${e.message}`);
      }
    }

    if (!html || html.length < 500) {
      return jsonError(
        `Impossible de récupérer la page Airbnb (tentatives: ${fetchErrors.join(', ')}). Vous pouvez importer les photos manuellement.`,
        500
      );
    }

    // --- Parse the HTML ---
    let data: AirbnbData | null = null;

    // Try hypernova JSON first
    try {
      data = parseFromHypernovaJson(html);
      console.log('Parsed via hypernova JSON');
    } catch (e) {
      console.log('Hypernova parse failed:', e.message);
    }

    // Fallback to meta/JSON-LD
    if (!data || (!data.title && data.images.length === 0)) {
      try {
        data = parseFromHTML(html);
        console.log('Parsed via meta/JSON-LD');
      } catch (e) {
        console.log('Meta/JSON-LD parse failed:', e.message);
      }
    }

    // Last resort: regex extraction
    if (!data || (!data.title && data.images.length === 0)) {
      try {
        data = parseFromRegex(html, listingId);
        console.log('Parsed via regex');
      } catch (e) {
        console.log('Regex parse failed:', e.message);
      }
    }

    if (!data || (!data.title && data.images.length === 0)) {
      return jsonError(
        "Données récupérées mais impossibles à analyser. Vous pouvez remplir le formulaire manuellement.",
        500
      );
    }

    return new Response(
      JSON.stringify({ success: true, data, imageCount: data.images.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('Error scraping Airbnb:', error);
    return jsonError(error.message || "Erreur lors du scraping", 500);
  }
});

function jsonError(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// --- Direct fetch ---
async function fetchPageDirect(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.7',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
    },
    redirect: 'follow',
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const text = await resp.text();
  if (text.length < 500) throw new Error('Page trop courte');
  return text;
}

// --- Proxy fetch ---
async function fetchViaProxy(proxyUrl: string, name: string): Promise<string> {
  const resp = await fetch(proxyUrl, {
    headers: {
      'Accept': 'text/html,application/json,*/*',
    },
    redirect: 'follow',
  });
  if (!resp.ok) throw new Error(`${name} HTTP ${resp.status}`);
  const text = await resp.text();
  if (text.length < 500) throw new Error(`${name} page trop courte`);
  // jina returns markdown, extract useful content
  if (name === 'jina') {
    return text; // still try to parse it
  }
  return text;
}

// --- Parse hypernova embedded JSON ---
function parseFromHypernovaJson(html: string): AirbnbData {
  const jsonMatch = html.match(/<script[^>]*data-hypernova-key="[^"]*"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
  if (!jsonMatch) throw new Error('No hypernova JSON found');

  const jsonData = JSON.parse(jsonMatch[1]);
  const listing = jsonData?.bootstrapData?.reduxData?.homePDP?.listingInfo?.listing
    || jsonData?.bootstrapData?.reduxData?.widgets?.listingInfo?.listing;
  if (!listing) throw new Error('Listing not found in hypernova');

  return extractFromListingObject(listing);
}

// --- Parse meta tags + JSON-LD ---
function parseFromHTML(html: string): AirbnbData {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
  const title = titleMatch ? titleMatch[1].replace(/\s*[-–|]\s*Airbnb\s*$/i, '').trim() : '';

  const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i)
    || html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);
  const description = descMatch ? decodeHtmlEntities(descMatch[1]) : '';

  const images: string[] = [];
  const ogMatches = html.matchAll(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/gi);
  for (const m of ogMatches) images.push(m[1]);

  let price = 0, bedrooms = 0, bathrooms = 0, max_guests = 0, address = '';
  let amenities: string[] = [];
  let bonusFeatures: string[] = [];

  const jsonLdMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdMatches) {
    try {
      const jsonLd = JSON.parse(match[1]);
      if (jsonLd['@type'] === 'Product' || jsonLd['@type'] === 'LodgingBusiness' || jsonLd['@type'] === 'Apartment') {
        if (jsonLd.offers?.price) price = parseFloat(jsonLd.offers.price);
        if (jsonLd.address) {
          address = typeof jsonLd.address === 'string' ? jsonLd.address :
            [jsonLd.address.streetAddress, jsonLd.address.addressLocality].filter(Boolean).join(', ');
        }
        if (jsonLd.numberOfRooms) bedrooms = parseInt(jsonLd.numberOfRooms);
        if (jsonLd.occupancy?.maxValue) max_guests = parseInt(jsonLd.occupancy.maxValue);
        if (jsonLd.amenityFeature) {
          for (const feat of jsonLd.amenityFeature) {
            const name = feat.name || '';
            const mapped = mapAmenity(name);
            if (mapped && !amenities.includes(mapped)) amenities.push(mapped);
            const bonus = mapBonus(name);
            if (bonus && !bonusFeatures.includes(bonus)) bonusFeatures.push(bonus);
          }
        }
        if (jsonLd.image) {
          if (Array.isArray(jsonLd.image)) {
            for (const img of jsonLd.image) {
              if (typeof img === 'string') images.push(img);
              else if (img.url) images.push(img.url);
            }
          } else if (typeof jsonLd.image === 'string') {
            images.push(jsonLd.image);
          }
        }
      }
    } catch { /* skip */ }
  }

  if (!title && images.length === 0) throw new Error('No usable data in HTML');

  return {
    title, description, price, bedrooms, bathrooms, max_guests,
    images: dedupe(images), amenities, bonusFeatures: bonusFeatures.length > 0 ? bonusFeatures : undefined,
    address,
  };
}

// --- Last resort: regex extraction ---
function parseFromRegex(html: string, listingId: string): AirbnbData {
  let title = '';
  const titleMatch = html.match(/"name"\s*:\s*"([^"]{5,200})"/);
  if (titleMatch) title = titleMatch[1];

  const images: string[] = [];
  const imgMatches = html.matchAll(/"(?:large|xlarge|picture|url|baseUrl|originalPicture)"\s*:\s*"(https:\/\/a0\.momcomstatic\.com[^"]+|https:\/\/images\.airbnb\.com[^"]+)"/gi);
  for (const m of imgMatches) {
    images.push(m[1].replace(/\\u002F/g, '/'));
  }

  // Broader image regex
  if (images.length === 0) {
    const broadMatches = html.matchAll(/"(https:\/\/(?:a0\.momcomstatic\.com|images\.airbnb\.com)[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi);
    for (const m of broadMatches) images.push(m[1].replace(/\\u002F/g, '/'));
  }

  if (!title && images.length === 0) throw new Error('Regex found nothing');

  return {
    title: title || `Airbnb #${listingId}`,
    description: '',
    price: 0, bedrooms: 0, bathrooms: 0, max_guests: 0,
    images: dedupe(images), amenities: [], address: '',
  };
}

// --- Shared extraction ---
function extractFromListingObject(listing: any): AirbnbData {
  const amenities: string[] = [];
  const bonusFeatures: string[] = [];

  if (listing.amenities) {
    for (const amenity of listing.amenities) {
      const name = amenity.name || '';
      const mapped = mapAmenity(name);
      if (mapped && !amenities.includes(mapped)) amenities.push(mapped);
      const bonus = mapBonus(name);
      if (bonus && !bonusFeatures.includes(bonus)) bonusFeatures.push(bonus);
    }
  }

  const images: string[] = [];
  if (listing.photos) {
    for (const photo of listing.photos) {
      const url = photo.large || photo.xlarge || photo.picture || photo.url || photo.originalPicture || photo.baseUrl || (typeof photo === 'string' ? photo : '');
      if (typeof url === 'string' && url.startsWith('http')) {
        images.push(url.replace(/\\u002F/g, '/'));
      }
    }
  }
  if (images.length === 0 && listing.images) {
    for (const img of listing.images) {
      const url = typeof img === 'string' ? img : (img.url || img.large || img.picture || '');
      if (typeof url === 'string' && url.startsWith('http')) images.push(url);
    }
  }

  let fullDescription = '';
  if (listing.sectionedDescription?.description) fullDescription = listing.sectionedDescription.description;
  else if (listing.description) fullDescription = listing.description;
  else if (listing.summary) fullDescription = listing.summary;

  if (listing.descriptionSections && Array.isArray(listing.descriptionSections)) {
    const parts: string[] = [];
    for (const section of listing.descriptionSections) {
      if (section.description) parts.push(section.description);
      else if (section.htmlDescription) parts.push(section.htmlDescription.replace(/<[^>]*>/g, ''));
    }
    if (parts.length > 0) fullDescription = parts.join('\n\n');
  }

  let propertyType = 'apartment';
  const roomType = (listing.roomType || '').toLowerCase();
  const ptText = (listing.propertyType || '').toLowerCase();
  if (roomType.includes('entire') && (ptText.includes('house') || ptText.includes('maison'))) propertyType = 'house';
  else if (roomType.includes('private') && !roomType.includes('entire')) propertyType = 'room';

  let apartmentArea: number | undefined;
  const spaceText = listing.spaceInfo || listing.space || '';
  if (spaceText) {
    const areaMatch = spaceText.match(/(\d+)\s*(m²|m2|sqm)/i);
    if (areaMatch) apartmentArea = parseInt(areaMatch[1]);
  }

  let hasElevator: boolean | undefined;
  if (listing.amenities) {
    hasElevator = listing.amenities.some((a: any) =>
      (a.name || '').toLowerCase().match(/elevator|lift|ascenseur/));
  }

  let furnished: string | undefined;
  if (listing.amenities) {
    const furnitureKeywords = ['Bed linens', 'Furniture', 'Essentials', 'Hangers', 'Iron'];
    const count = furnitureKeywords.filter(kw => listing.amenities.some((a: any) => (a.name || '').includes(kw))).length;
    if (count >= 2) furnished = 'furnished';
  }

  let floor: number | undefined;
  const fullText = `${listing.name || ''} ${fullDescription || ''} ${listing.summary || ''}`;
  const floorPatterns = [/(\d+)(?:er|ème|e)\s*étage/i, /floor\s*(\d+)/i, /(\d+)(?:st|nd|rd|th)\s*floor/i, /étage\s*(\d+)/i];
  for (const p of floorPatterns) {
    const m = fullText.match(p);
    if (m) { floor = parseInt(m[1]); break; }
  }
  if (floor === undefined && fullText.toLowerCase().match(/rez-de-chaussée|ground floor|rdc/)) floor = 0;

  return {
    title: listing.name || '',
    description: fullDescription || '',
    price: listing.price?.rate?.amount || listing.price?.total?.amount || 0,
    bedrooms: listing.bedrooms || 0,
    bathrooms: listing.bathrooms || 0,
    max_guests: listing.personCapacity || 0,
    images: dedupe(images),
    amenities,
    bonusFeatures: bonusFeatures.length > 0 ? bonusFeatures : undefined,
    address: listing.publicAddress || '',
    latitude: listing.lat,
    longitude: listing.lng,
    propertyType,
    apartmentArea,
    hasElevator,
    furnished,
    floor,
  };
}

// --- Helpers ---
function mapAmenity(name: string): string | null {
  const n = name.toLowerCase();
  const map: Record<string, string> = {
    'wifi': 'WiFi',
    'kitchen': 'Cuisine équipée / Equipped kitchen',
    'washer': 'Lave-linge / Washing machine',
    'dryer': 'Lave-linge / Washing machine',
    'parking': 'Parking',
    'garden': 'Jardin / Garden',
    'balcony': 'Balcon / Balcony',
    'patio': 'Balcon / Balcony',
    'air conditioning': 'Climatisation / Air conditioning',
    'heating': 'Chauffage / Heating',
    'tv': 'TV',
    'workspace': 'Bureau / Desk',
    'desk': 'Bureau / Desk',
  };
  for (const [key, val] of Object.entries(map)) {
    if (n.includes(key)) return val;
  }
  return null;
}

function mapBonus(name: string): string | null {
  const n = name.toLowerCase();
  const map: Record<string, string> = {
    'netflix': 'Netflix',
    'disney': 'Disney+',
    'amazon prime': 'Amazon Prime Video',
    'pool': 'Piscine / Swimming pool',
    'swimming': 'Piscine / Swimming pool',
    'gym': 'Salle de sport / Gym access',
    'game console': 'Console de jeux / Game console',
    'bike': 'Vélo / Bicycle',
    'scooter': 'Trottinette / Scooter',
    'terrace': 'Terrasse privée / Private terrace',
    'storage': 'Cave / Storage room',
  };
  for (const [key, val] of Object.entries(map)) {
    if (n.includes(key)) return val;
  }
  return null;
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}
