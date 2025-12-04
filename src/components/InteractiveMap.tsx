import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { MapPin, Home, Euro, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';

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
              <p className="text-gray-600 mb-4 flex items-center">
                <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                {selectedListing.address || selectedListing.city}
              </p>

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
