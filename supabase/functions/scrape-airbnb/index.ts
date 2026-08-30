import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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
  downloadedImages?: string[];
  amenities: string[];
  bonusFeatures?: string[];
  address: string;
  latitude?: number;
  longitude?: number;
  propertyType?: string;
  apartmentArea?: number;
  buildingYear?: number;
  floor?: number;
  totalFloors?: number;
  hasElevator?: boolean;
  furnished?: string;
}

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { url } = await req.json();

    if (!url || !url.includes('airbnb')) {
      return new Response(
        JSON.stringify({ success: false, error: "URL Airbnb invalide" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const listingIdMatch = url.match(/\/rooms\/(\d+)/);
    if (!listingIdMatch) {
      return new Response(
        JSON.stringify({ success: false, error: "Impossible d'extraire l'ID de l'annonce" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const listingId = listingIdMatch[1];
    console.log(`Fetching Airbnb listing: ${url} (ID: ${listingId})`);

    // Strategy 1: Try Airbnb's internal API (returns JSON with all photo URLs)
    let data: AirbnbData | null = null;

    try {
      data = await fetchViaInternalApi(listingId, url);
      console.log('Strategy 1 (internal API) succeeded');
    } catch (e) {
      console.log('Strategy 1 (internal API) failed:', e.message);
    }

    // Strategy 2: Fetch HTML page and parse embedded JSON data
    if (!data || (data.images.length === 0 && !data.title)) {
      try {
        const html = await fetchPageHtml(url);
        data = parseFromHypernovaJson(html);
        console.log('Strategy 2 (hypernova JSON) succeeded');
      } catch (e) {
        console.log('Strategy 2 (hypernova JSON) failed:', e.message);
      }
    }

    // Strategy 3: Fetch HTML and parse meta tags + JSON-LD
    if (!data || (data.images.length === 0 && !data.title)) {
      try {
        const html = await fetchPageHtml(url);
        data = parseFromHTML(html);
        console.log('Strategy 3 (meta/JSON-LD) succeeded');
      } catch (e) {
        console.log('Strategy 3 (meta/JSON-LD) failed:', e.message);
      }
    }

    if (!data || (data.images.length === 0 && !data.title)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Impossible de récupérer les données de cette annonce Airbnb. Airbnb bloque parfois l'accès automatisé. Vous pouvez importer les photos manuellement.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Download all images to Supabase storage
    const downloadedImages: string[] = [];
    if (data.images && data.images.length > 0) {
      console.log(`Downloading ${data.images.length} images...`);

      for (let i = 0; i < Math.min(data.images.length, 30); i++) {
        try {
          const imageUrl = data.images[i];
          console.log(`Downloading image ${i + 1}/${data.images.length}: ${imageUrl.substring(0, 80)}...`);

          const imageResponse = await fetch(imageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            },
            redirect: 'follow',
          });
          if (!imageResponse.ok) {
            console.error(`Failed to download image ${i + 1}: ${imageResponse.status}`);
            continue;
          }

          const imageBlob = await imageResponse.blob();
          const arrayBuffer = await imageBlob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          const contentType = imageBlob.type || 'image/jpeg';
          const fileExt = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
          const fileName = `airbnb-import-${Date.now()}-${i}.${fileExt}`;
          const filePath = `listings/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('images')
            .upload(filePath, uint8Array, {
              contentType,
              upsert: false,
            });

          if (uploadError) {
            console.error(`Error uploading image ${i + 1}:`, uploadError);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('images')
            .getPublicUrl(filePath);

          downloadedImages.push(publicUrl);
          console.log(`Image ${i + 1} uploaded successfully`);
        } catch (error) {
          console.error(`Error processing image ${i + 1}:`, error);
        }
      }
    }

    data.downloadedImages = downloadedImages;

    return new Response(
      JSON.stringify({
        success: true,
        data,
        imageCount: downloadedImages.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error('Error scraping Airbnb:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Erreur lors du scraping",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// --- Strategy 1: Airbnb internal API ---
async function fetchViaInternalApi(listingId: string, originalUrl: string): Promise<AirbnbData> {
  const apiKey = Deno.env.get("AIRBNB_API_KEY");
  const apiUrl = `https://www.airbnb.fr/api/v3/PdpListingDetail?variables=%7B%22request%22%3A%7B%22listingId%22%3A%22${listingId}%22%2C%22shouldUseRefetch%22%3Afalse%7D%7D&extensions=%7B%22persistedQuery%22%3A%7B%22version%22%3A1%2C%22sha256Hash%22%3A%22${apiKey || 'a9e24a6f5b3e4c8d7f1e2a6b9c4d8e7f3a1b6c9d2e8f4a7b1c6d9e3f2a8b4'}%22%7D%7D`;

  const response = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'X-Airbnb-API-Key': apiKey || '',
      'X-Client-Version': '0.2.5',
    },
  });

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  const json = await response.json();
  const listing = json?.data?.presentation?.exploreSections?.sections?.[0]?.section?.listings?.[0]?.listing
    || json?.data?.presentation?.listing?.listing;

  if (!listing) {
    throw new Error('Listing data not found in API response');
  }

  return extractFromListingObject(listing);
}

// --- Strategy 2: Parse Hypernova embedded JSON ---
function parseFromHypernovaJson(html: string): AirbnbData {
  const jsonMatch = html.match(/<script[^>]*data-hypernova-key="spaspabundlejs"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
  if (!jsonMatch) {
    throw new Error('No hypernova JSON found');
  }

  const jsonData = JSON.parse(jsonMatch[1]);
  const listing = jsonData?.bootstrapData?.reduxData?.homePDP?.listingInfo?.listing;
  if (!listing) {
    throw new Error('Listing data not found in hypernova JSON');
  }

  return extractFromListingObject(listing);
}

// --- Strategy 3: Parse meta tags + JSON-LD from HTML ---
function parseFromHTML(html: string): AirbnbData {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
  const title = titleMatch ? titleMatch[1].replace(' - Airbnb', '').trim() : '';

  const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/);
  const description = descMatch ? descMatch[1] : '';

  const images: string[] = [];
  const imageMatches = html.matchAll(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/g);
  for (const match of imageMatches) {
    images.push(match[1]);
  }

  // Also try to find image URLs in JSON-LD
  const jsonLdMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g);
  let price = 0;
  let bedrooms = 0;
  let bathrooms = 0;
  let max_guests = 0;
  let address = '';

  for (const match of jsonLdMatches) {
    try {
      const jsonLd = JSON.parse(match[1]);
      if (jsonLd['@type'] === 'Product' || jsonLd['@type'] === 'LodgingBusiness') {
        if (jsonLd.offers?.price) {
          price = parseFloat(jsonLd.offers.price);
        }
        if (jsonLd.address) {
          address = typeof jsonLd.address === 'string' ? jsonLd.address :
                   (jsonLd.address.streetAddress || jsonLd.address.addressLocality || '');
        }
        if (jsonLd.numberOfRooms) {
          bedrooms = parseInt(jsonLd.numberOfRooms);
        }
        if (jsonLd.occupancy?.maxValue) {
          max_guests = parseInt(jsonLd.occupancy.maxValue);
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
    } catch (e) {
      // skip invalid JSON-LD
    }
  }

  if (!title && images.length === 0) {
    throw new Error('No usable data found in HTML');
  }

  return {
    title,
    description,
    price,
    bedrooms,
    bathrooms,
    max_guests,
    images,
    amenities: [],
    address,
  };
}

// --- Shared extraction from listing object ---
function extractFromListingObject(listing: any): AirbnbData {
  const amenities: string[] = [];
  const bonusFeatures: string[] = [];

  const amenityMapping: { [key: string]: string } = {
    'Wifi': 'WiFi',
    'Kitchen': 'Cuisine équipée / Equipped kitchen',
    'Washer': 'Lave-linge / Washing machine',
    'Dryer': 'Lave-linge / Washing machine',
    'Free parking': 'Parking',
    'Parking': 'Parking',
    'Garden': 'Jardin / Garden',
    'Balcony': 'Balcon / Balcony',
    'Patio': 'Balcon / Balcony',
    'Air conditioning': 'Climatisation / Air conditioning',
    'Heating': 'Chauffage / Heating',
    'TV': 'TV',
    'Workspace': 'Bureau / Desk',
    'Desk': 'Bureau / Desk',
  };

  const bonusMapping: { [key: string]: string } = {
    'Netflix': 'Netflix',
    'Disney+': 'Disney+',
    'Amazon Prime': 'Amazon Prime Video',
    'Pool': 'Piscine / Swimming pool',
    'Swimming pool': 'Piscine / Swimming pool',
    'Gym': 'Salle de sport / Gym access',
    'Hot tub': 'Piscine / Swimming pool',
    'Game console': 'Console de jeux / Game console',
    'Bike': 'Vélo / Bicycle',
    'Scooter': 'Trottinette / Scooter',
    'Private entrance': 'Terrasse privée / Private terrace',
    'Terrace': 'Terrasse privée / Private terrace',
    'Storage': 'Cave / Storage room',
  };

  if (listing.amenities) {
    listing.amenities.forEach((amenity: any) => {
      const amenityName = amenity.name || '';

      for (const [key, value] of Object.entries(amenityMapping)) {
        if (amenityName.toLowerCase().includes(key.toLowerCase())) {
          if (!amenities.includes(value)) {
            amenities.push(value);
          }
          break;
        }
      }

      for (const [key, value] of Object.entries(bonusMapping)) {
        if (amenityName.toLowerCase().includes(key.toLowerCase())) {
          if (!bonusFeatures.includes(value)) {
            bonusFeatures.push(value);
          }
          break;
        }
      }
    });
  }

  // Extract images - try multiple photo formats
  const images: string[] = [];
  if (listing.photos) {
    listing.photos.forEach((photo: any) => {
      // Try various photo URL fields in order of preference (largest first)
      const url = photo.large || photo.xlarge || photo.picture || photo.url || photo.originalPicture || photo.baseUrl || photo;
      if (typeof url === 'string' && url.startsWith('http')) {
        images.push(url);
      } else if (photo.picture) {
        images.push(photo.picture);
      }
    });
  }

  // Also check for images in different structures
  if (images.length === 0 && listing.images) {
    listing.images.forEach((img: any) => {
      const url = typeof img === 'string' ? img : (img.url || img.large || img.picture);
      if (typeof url === 'string' && url.startsWith('http')) {
        images.push(url);
      }
    });
  }

  // Extract description
  let fullDescription = '';
  if (listing.description) {
    fullDescription = listing.description;
  }
  if (listing.sectionedDescription?.description) {
    fullDescription = listing.sectionedDescription.description;
  }
  if (listing.descriptionSections && Array.isArray(listing.descriptionSections)) {
    const descriptionParts: string[] = [];
    listing.descriptionSections.forEach((section: any) => {
      if (section.description) {
        descriptionParts.push(section.description);
      } else if (section.htmlDescription) {
        const cleanHtml = section.htmlDescription.replace(/<[^>]*>/g, '');
        descriptionParts.push(cleanHtml);
      }
    });
    if (descriptionParts.length > 0) {
      fullDescription = descriptionParts.join('\n\n');
    }
  }
  if (!fullDescription && listing.summary) {
    fullDescription = listing.summary;
  }

  // Property type
  let propertyType = 'apartment';
  const roomType = listing.roomType?.toLowerCase() || '';
  const propertyTypeText = listing.propertyType?.toLowerCase() || '';
  if (roomType.includes('entire') && (propertyTypeText.includes('house') || propertyTypeText.includes('maison'))) {
    propertyType = 'house';
  } else if (roomType.includes('private') && !roomType.includes('entire')) {
    propertyType = 'room';
  }

  // Apartment area
  let apartmentArea: number | undefined;
  if (listing.spaceInfo || listing.space) {
    const spaceText = listing.spaceInfo || listing.space || '';
    const areaMatch = spaceText.match(/(\d+)\s*(m²|m2|sqm)/i);
    if (areaMatch) {
      apartmentArea = parseInt(areaMatch[1]);
    }
  }

  // Furnished detection
  let furnished: string | undefined;
  const furnishedAmenities = ['Bed linens', 'Furniture', 'Essentials'];
  let hasFurnitureAmenities = 0;
  if (listing.amenities) {
    furnishedAmenities.forEach(item => {
      if (listing.amenities.some((a: any) => a.name?.includes(item))) {
        hasFurnitureAmenities++;
      }
    });
  }
  if (hasFurnitureAmenities >= 2) {
    furnished = 'furnished';
  }

  // Elevator
  let hasElevator: boolean | undefined;
  if (listing.amenities) {
    hasElevator = listing.amenities.some((a: any) =>
      a.name?.toLowerCase().includes('elevator') ||
      a.name?.toLowerCase().includes('lift') ||
      a.name?.toLowerCase().includes('ascenseur')
    );
  }

  // Floor
  let floor: number | undefined;
  const floorPatterns = [
    /(\d+)(?:er|ème|e)\s*étage/i,
    /floor\s*(\d+)/i,
    /(\d+)(?:st|nd|rd|th)\s*floor/i,
    /étage\s*(\d+)/i,
  ];
  const fullText = `${listing.name || ''} ${fullDescription || ''} ${listing.summary || ''}`;
  for (const pattern of floorPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      floor = parseInt(match[1]);
      break;
    }
  }
  if (!floor && (
    fullText.toLowerCase().includes('rez-de-chaussée') ||
    fullText.toLowerCase().includes('ground floor') ||
    fullText.toLowerCase().includes('rdc')
  )) {
    floor = 0;
  }

  return {
    title: listing.name || '',
    description: fullDescription || '',
    price: listing.price?.rate?.amount || listing.price?.total?.amount || 0,
    bedrooms: listing.bedrooms || 0,
    bathrooms: listing.bathrooms || 0,
    max_guests: listing.personCapacity || 0,
    images,
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

// --- Fetch HTML page with browser-like headers ---
async function fetchPageHtml(url: string): Promise<string> {
  const pageResponse = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    },
    redirect: 'follow',
  });

  if (!pageResponse.ok) {
    throw new Error(`Failed to fetch page: ${pageResponse.status}`);
  }

  const html = await pageResponse.text();
  if (!html) {
    throw new Error('Aucune donnée HTML récupérée');
  }

  return html;
}
