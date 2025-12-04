import { Heart, MapPin, Home, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

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
  };
  onNavigate: (page: string, listingId?: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (listingId: string) => void;
};

export default function ListingCard({
  listing,
  onNavigate,
  isFavorite = false,
  onToggleFavorite,
}: ListingCardProps) {
  const [imageError, setImageError] = useState(false);
  const { t, translateFeature } = useLanguage();

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
      onClick={() => onNavigate('listing', listing.id)}
    >
      <div className="relative h-48 overflow-hidden flex-shrink-0">
        <img
          src={imageError ? defaultImage : listing.image_url || defaultImage}
          alt={listing.title}
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

        <div className="flex items-center text-gray-600 mb-2">
          <MapPin className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
          <span className="text-xs line-clamp-1">
            {listing.address ? `${listing.address}, ${listing.city}` : listing.city}
          </span>
        </div>


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
