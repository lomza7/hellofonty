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

    console.log(`Fetching Airbnb page: ${url}`);

    const pageResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });

    if (!pageResponse.ok) {
      console.error(`Failed to fetch page: ${pageResponse.status}`);
      return new Response(
        JSON.stringify({ success: false, error: `Impossible de récupérer la page Airbnb (${pageResponse.status})` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const html = await pageResponse.text();

    if (!html) {
      return new Response(
        JSON.stringify({ success: false, error: "Aucune donnée HTML récupérée" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('Page fetched successfully, parsing data...');

    const jsonMatch = html.match(/<script[^>]*data-hypernova-key="spaspabundlejs"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/);

    let data: AirbnbData;

    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1]);
        const listing = jsonData?.bootstrapData?.reduxData?.homePDP?.listingInfo?.listing;

        if (listing) {
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

          const images: string[] = [];
          if (listing.photos) {
            listing.photos.forEach((photo: any) => {
              if (photo.picture) {
                images.push(photo.picture);
              } else if (photo.url) {
                images.push(photo.url);
              } else if (photo.large) {
                images.push(photo.large);
              } else if (photo.xlarge) {
                images.push(photo.xlarge);
              }
            });
          }

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

          let propertyType = 'apartment';
          const roomType = listing.roomType?.toLowerCase() || '';
          const propertyTypeText = listing.propertyType?.toLowerCase() || '';

          if (roomType.includes('entire') && (propertyTypeText.includes('house') || propertyTypeText.includes('maison'))) {
            propertyType = 'house';
          } else if (roomType.includes('private') && !roomType.includes('entire')) {
            propertyType = 'room';
          }

          let apartmentArea: number | undefined;
          if (listing.spaceInfo || listing.space) {
            const spaceText = listing.spaceInfo || listing.space || '';
            const areaMatch = spaceText.match(/(\d+)\s*(m²|m2|sqm)/i);
            if (areaMatch) {
              apartmentArea = parseInt(areaMatch[1]);
            }
          }

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

          let hasElevator: boolean | undefined;
          if (listing.amenities) {
            hasElevator = listing.amenities.some((a: any) =>
              a.name?.toLowerCase().includes('elevator') ||
              a.name?.toLowerCase().includes('lift') ||
              a.name?.toLowerCase().includes('ascenseur')
            );
          }

          let floor: number | undefined;
          let totalFloors: number | undefined;

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

          data = {
            title: listing.name || '',
            description: fullDescription || '',
            price: listing.price?.rate?.amount || 0,
            bedrooms: listing.bedrooms || 0,
            bathrooms: listing.bathrooms || 0,
            max_guests: listing.personCapacity || 0,
            images: images,
            amenities: amenities,
            bonusFeatures: bonusFeatures.length > 0 ? bonusFeatures : undefined,
            address: listing.publicAddress || '',
            latitude: listing.lat,
            longitude: listing.lng,
            propertyType: propertyType,
            apartmentArea: apartmentArea,
            hasElevator: hasElevator,
            furnished: furnished,
            floor: floor,
            totalFloors: totalFloors,
          };
        } else {
          throw new Error('Listing data not found');
        }
      } catch (e) {
        console.error('Error parsing JSON:', e);
        data = parseFromHTML(html);
      }
    } else {
      data = parseFromHTML(html);
    }

    const downloadedImages: string[] = [];
    if (data.images && data.images.length > 0) {
      console.log(`Downloading ${data.images.length} images...`);

      for (let i = 0; i < Math.min(data.images.length, 20); i++) {
        try {
          const imageUrl = data.images[i];
          console.log(`Downloading image ${i + 1}/${data.images.length}: ${imageUrl}`);

          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) {
            console.error(`Failed to download image ${i + 1}`);
            continue;
          }

          const imageBlob = await imageResponse.blob();
          const arrayBuffer = await imageBlob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          const fileExt = imageUrl.includes('.jpg') ? 'jpg' : 'jpeg';
          const fileName = `airbnb-import-${Date.now()}-${i}.${fileExt}`;
          const filePath = `listings/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('images')
            .upload(filePath, uint8Array, {
              contentType: imageBlob.type || 'image/jpeg',
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
      JSON.stringify({ success: true, data }),
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

  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  let price = 0;
  let bedrooms = 0;
  let bathrooms = 0;
  let max_guests = 0;
  let address = '';

  if (jsonLdMatch) {
    try {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      if (jsonLd['@type'] === 'Product' || jsonLd['@type'] === 'LodgingBusiness') {
        if (jsonLd.offers?.price) {
          price = parseFloat(jsonLd.offers.price);
        }
        if (jsonLd.address) {
          address = typeof jsonLd.address === 'string' ? jsonLd.address : 
                   (jsonLd.address.streetAddress || jsonLd.address.addressLocality || '');
        }
      }
    } catch (e) {
      console.error('Error parsing JSON-LD:', e);
    }
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
