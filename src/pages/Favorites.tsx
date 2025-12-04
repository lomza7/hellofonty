import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, BedDouble, Bath, Users, Heart } from 'lucide-react';
import { supabase, Favorite } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

export default function Favorites() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, [profile]);

  const loadFavorites = async () => {
    if (!profile) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('favorites')
      .select(`
        *,
        listing:listings(
          *,
          landlord:profiles!landlord_id(first_name, last_name),
          images:listing_images(*)
        )
      `)
      .eq('student_id', profile.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setFavorites(data);
    }
    setLoading(false);
  };

  const removeFavorite = async (favoriteId: string, listingId: string) => {
    await supabase.from('favorites').delete().eq('id', favoriteId);
    setFavorites((prev) => prev.filter((f) => f.id !== favoriteId));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">{t('favorites.title')}</h1>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <p className="text-xl text-gray-600 mb-6">{t('favorites.empty')}</p>
            <button
              onClick={() => navigate('/recherche')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              {t('nav.search')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((favorite) => {
              const listing = favorite.listing;
              if (!listing) return null;

              return (
                <div
                  key={favorite.id}
                  className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow"
                >
                  <div
                    onClick={() => navigate(`/logement/${listing.id}`)}
                    className="relative h-48 bg-gradient-to-br from-blue-400 to-blue-600 cursor-pointer"
                  >
                    {listing.images && listing.images.length > 0 ? (
                      <img
                        src={listing.images[0].image_url}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <MapPin className="h-16 w-16 text-white opacity-50" />
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFavorite(favorite.id, listing.id);
                      }}
                      className="absolute top-3 right-3 p-2 bg-white rounded-full shadow-lg hover:scale-110 transition-transform"
                    >
                      <Heart className="h-6 w-6 fill-red-500 text-red-500" />
                    </button>
                  </div>

                  <div
                    onClick={() => navigate(`/logement/${listing.id}`)}
                    className="p-5 cursor-pointer"
                  >
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{listing.title}</h3>

                    <div className="flex items-center text-gray-600 mb-3">
                      <MapPin className="h-4 w-4 mr-1" />
                      <span className="text-sm">
                        {listing.city}, {listing.postal_code}
                      </span>
                    </div>

                    <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center">
                        <BedDouble className="h-4 w-4 mr-1" />
                        <span>
                          {listing.bedrooms} {t('listing.bedrooms')}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <Bath className="h-4 w-4 mr-1" />
                        <span>
                          {listing.bathrooms} {t('listing.bathrooms')}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-1" />
                        <span>
                          {listing.max_guests} {t('listing.guests')}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t">
                      <span className="text-2xl font-bold text-blue-600">
                        {listing.price_per_month}€
                      </span>
                      <span className="text-gray-600 text-sm">
                        /{t('listing.perMonth').split('/')[1]}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
