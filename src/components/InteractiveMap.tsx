import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { MapPin, Home, Euro, X, Car } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';

const INSEAD_LAT = 48.405527;
const INSEAD_LNG = 2.686894;

type Listing = {
  id: string;
  title: string;
  address?: string;
  city: string;
  property_type: string;
  price_per_month: number;
  bedrooms: number;
  image_url?: string;
  latitude: number;
  longitude: number;
};

export default function InteractiveMap() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    fetchListings();

    // S'abonner aux changements en temps réel
    const channel = supabase
      .channel('listings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'listings' },
        () => {
          fetchListings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (listings.length > 0 && mapContainerRef.current && !mapRef.current) {
      initMap();
    } else if (listings.length > 0 && mapRef.current) {
      updateMarkers();
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [listings]);

  useEffect(() => {
    if (!selectedListing) { setRouteInfo(null); return; }
    setRouteInfo(null);
    const url = `https://router.project-osrm.org/route/v1/driving/${selectedListing.longitude},${selectedListing.latitude};${INSEAD_LNG},${INSEAD_LAT}?overview=false`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (!data.routes?.length) return;
        const distM = data.routes[0].distance as number;
        const durS = data.routes[0].duration as number;
        const distance = distM < 1000 ? `${Math.round(distM)} m` : `${(distM / 1000).toFixed(1)} km`;
        const durMin = Math.round(durS / 60);
        const duration = durMin < 60 ? `${durMin} min` : `${Math.floor(durMin / 60)}h${String(durMin % 60).padStart(2, '0')}`;
        setRouteInfo({ distance, duration });
      })
      .catch(() => {});
  }, [selectedListing]);

  const createMarker = (listing: Listing, map: L.Map) => {
    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: `
        <div class="relative group cursor-pointer">
          <svg class="h-10 w-10 text-rose-600 drop-shadow-lg transition-transform group-hover:scale-110" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          <div class="absolute -bottom-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-rose-600 text-white rounded-full text-xs font-bold whitespace-nowrap shadow-lg">
            ${listing.price_per_month}€
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    });

    const marker = L.marker([listing.latitude, listing.longitude], {
      icon: customIcon,
    }).addTo(map);

    marker.on('click', () => {
      setSelectedListing(listing);
      map.panTo([listing.latitude, listing.longitude]);
    });

    return marker;
  };

  const updateMarkers = () => {
    if (!mapRef.current) return;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    listings.forEach((listing) => {
      const marker = createMarker(listing, mapRef.current!);
      markersRef.current.push(marker);
    });
  };

  const initMap = () => {
    if (!mapContainerRef.current) return;

    const fontainebleauCenter: [number, number] = [48.4084, 2.7007];

    const map = L.map(mapContainerRef.current, {
      center: fontainebleauCenter,
      zoom: 14,
      zoomControl: true,
      scrollWheelZoom: false,
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    listings.forEach((listing) => {
      const marker = createMarker(listing, map);
      markersRef.current.push(marker);
    });

    // Ajouter le marqueur INSEAD
    const inseadIcon = L.divIcon({
      className: 'insead-marker',
      html: `
        <div class="relative group cursor-pointer">
          <div class="h-12 w-12 rounded-full overflow-hidden border-4 border-green-700 shadow-xl transition-transform group-hover:scale-110 bg-white">
            <img src="/logo-insead.jpg" alt="INSEAD" class="h-full w-full object-cover" />
          </div>
          <div class="absolute -bottom-8 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-green-700 text-white rounded-full text-xs font-bold whitespace-nowrap shadow-lg">
            INSEAD
          </div>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 48],
    });

    const inseadMarker = L.marker([48.403994, 2.687018], {
      icon: inseadIcon,
    }).addTo(map);

    inseadMarker.bindPopup(`
      <div class="p-2 text-center">
        <img src="/logo-insead.jpg" alt="INSEAD" class="h-16 w-16 rounded-full mx-auto mb-2 border-2 border-green-700" />
        <h3 class="font-bold text-green-800 text-lg">INSEAD</h3>
        <p class="text-gray-600 text-sm">Boulevard de Constance<br/>77300 Fontainebleau</p>
      </div>
    `, {
      maxWidth: 200,
      className: 'insead-popup'
    });

    mapRef.current = map;
  };

  const fetchListings = async () => {
    try {
      const { data: listingsData, error: listingsError } = await supabase
        .from('listings')
        .select('id, title, address, city, property_type, price_per_month, bedrooms, latitude, longitude')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (listingsError) throw listingsError;

      if (listingsData) {
        const listingsWithImages = await Promise.all(
          listingsData.map(async (listing) => {
            const { data: imageData } = await supabase
              .from('listing_images')
              .select('image_url')
              .eq('listing_id', listing.id)
              .order('display_order', { ascending: true })
              .limit(1)
              .maybeSingle();

            return {
              ...listing,
              image_url: imageData?.image_url,
              latitude: listing.latitude ? parseFloat(listing.latitude.toString()) : 48.4084,
              longitude: listing.longitude ? parseFloat(listing.longitude.toString()) : 2.7007,
            };
          })
        );

        const validListings = listingsWithImages.filter(
          listing => listing.latitude && listing.longitude
        );

        setListings(validListings);
      }
    } catch (error) {
      console.error('Error fetching listings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[600px] bg-gray-100 rounded-3xl animate-pulse flex items-center justify-center">
        <div className="text-gray-400">Chargement de la carte...</div>
      </div>
    );
  }

  return (
    <div className="relative h-[600px] rounded-3xl overflow-hidden shadow-2xl">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      <div className="absolute top-6 left-6 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg px-4 py-3 z-[1000]">
        <div className="flex items-center space-x-2 text-sm">
          <MapPin className="h-5 w-5 text-rose-600 fill-rose-600" />
          <span className="font-medium text-gray-900">
            {listings.length} {listings.length === 1 ? t('listing.singular') : t('listing.plural')} {listings.length === 1 ? t('listing.availableSingular') : t('listing.available')}
          </span>
        </div>
      </div>

      {selectedListing && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-[90%] max-w-md z-[1000]">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            <button
              onClick={() => setSelectedListing(null)}
              className="absolute top-3 right-3 z-10 p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition shadow-lg"
            >
              <X className="h-4 w-4 text-gray-700" />
            </button>

            <div className="relative h-48">
              {selectedListing.image_url ? (
                <img
                  src={selectedListing.image_url}
                  alt={selectedListing.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                  <Home className="h-16 w-16 text-gray-400" />
                </div>
              )}
              <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center space-x-1">
                <Euro className="h-4 w-4 text-rose-600" />
                <span className="font-bold text-gray-900">
                  {selectedListing.price_per_month}€
                </span>
                <span className="text-sm text-gray-600">{t('listing.perMonth')}</span>
              </div>
            </div>

            <div className="p-5">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {selectedListing.title}
              </h3>
              <p className="text-gray-600 mb-2 flex items-center">
                <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                {selectedListing.address || selectedListing.city}
              </p>

              <div className="flex items-center gap-1.5 mb-4">
                <Car className="h-3.5 w-3.5 text-[#1e3a5f] flex-shrink-0" />
                {routeInfo ? (
                  <span className="text-xs font-semibold text-[#1e3a5f]">
                    {routeInfo.distance} · {routeInfo.duration} d'INSEAD
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 italic">Calcul en cours...</span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span>{selectedListing.bedrooms} chambres</span>
                  <span className="text-gray-300">•</span>
                  <span className="capitalize">{selectedListing.property_type}</span>
                </div>

                <button
                  onClick={() => navigate(`/logement/${selectedListing.id}`)}
                  className="px-6 py-2.5 bg-rose-600 text-white rounded-full hover:bg-rose-700 transition font-medium text-sm"
                >
                  Voir détails
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
