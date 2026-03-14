import { Heart, MapPin, Home, Sparkles, Car } from 'lucide-react';
import { useState, memo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const INSEAD_LAT = 48.405527;
const INSEAD_LNG = 2.686894;

type ListingCardProps = {
  listing: {
    id: string;
    title: string;
    address?: string;
    city: string;
    property_type: string;
    price_per_month: number;
    bedrooms: number;
    bathrooms: number;
    image_url?: string;
    bonus_features?: string[];
    latitude?: number | null;
    longitude?: number | null;
  };
  isFavorite?: boolean;
  onToggleFavorite?: (listingId: string) => void;
};

function ListingCard({
  listing,
  isFavorite = false,
  onToggleFavorite,
}: ListingCardProps) {
  const [imageError, setImageError] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const navigate = useNavigate();
  const { t, translateFeature } = useLanguage();

  useEffect(() => {
    if (!listing.latitude || !listing.longitude) return;
    const url = `https://router.project-osrm.org/route/v1/driving/${listing.longitude},${listing.latitude};${INSEAD_LNG},${INSEAD_LAT}?overview=false`;
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
  }, [listing.latitude, listing.longitude]);

  const getPropertyTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      apartment: `🏢 ${t('search.propertyType.option.apartment')}`,
      house: `🏠 ${t('search.propertyType.option.house')}`,
      room: `🛏️ ${t('search.propertyType.option.room')}`,
      studio: `🏠 ${t('search.propertyType.option.studio')}`,
    };
    return labels[type] || type;
  };

  const defaultImage = 'https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg?auto=compress&cs=tinysrgb&w=800';

  return (
    <div
      className="group cursor-pointer bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 h-full flex flex-col"
      onClick={() => navigate(`/logement/${listing.id}`)}
    >
      <div className="relative h-48 overflow-hidden flex-shrink-0">
        <img
          src={imageError ? defaultImage : listing.image_url || defaultImage}
          alt={listing.title}
          loading="lazy"
          decoding="async"
          onError={() => setImageError(true)}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(listing.id);
            }}
            className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-white hover:scale-110 transition-all shadow-lg"
          >
            <Heart
              className={`h-5 w-5 transition-colors ${
                isFavorite ? 'fill-rose-500 text-rose-500' : 'text-gray-700'
              }`}
            />
          </button>
        )}
        <div className="absolute bottom-4 left-4">
          <span className="px-3 py-1 bg-white/95 backdrop-blur-sm text-gray-900 text-sm font-medium rounded-full shadow-md">
            {getPropertyTypeLabel(listing.property_type)}
          </span>
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-base font-semibold text-gray-900 mb-2 line-clamp-1 group-hover:text-rose-500 transition-colors">
          {listing.title}
        </h3>

        <div className="flex items-center text-gray-600 mb-1">
          <MapPin className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
          <span className="text-xs line-clamp-1">
            {listing.address ? `${listing.address}, ${listing.city}` : listing.city}
          </span>
        </div>

        {listing.latitude && listing.longitude && (
          <div className="flex items-center gap-1.5 mb-2">
            <Car className="h-3.5 w-3.5 text-[#1e3a5f] flex-shrink-0" />
            {routeInfo ? (
              <span className="text-xs font-medium text-[#1e3a5f]">
                {routeInfo.distance} · {routeInfo.duration} d'INSEAD
              </span>
            ) : (
              <span className="text-xs text-gray-400 italic">Calcul...</span>
            )}
          </div>
        )}


        {listing.bonus_features && listing.bonus_features.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {listing.bonus_features.slice(0, 2).map((bonus, idx) => (
              <span
                key={idx}
                className="inline-flex items-center space-x-1 px-1.5 py-0.5 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 text-xs font-medium rounded border border-amber-200"
              >
                <Sparkles className="h-2.5 w-2.5" />
                <span className="line-clamp-1 text-xs">{translateFeature(bonus)}</span>
              </span>
            ))}
            {listing.bonus_features.length > 2 && (
              <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded">
                +{listing.bonus_features.length - 2}
              </span>
            )}
          </div>
        )}

        <div className="flex items-baseline justify-between mt-auto">
          <div>
            <span className="text-xl font-bold text-gray-900">
              {listing.price_per_month.toLocaleString()}€
            </span>
            <span className="text-gray-600 text-xs ml-1">{t('listing.perMonth')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(ListingCard);
