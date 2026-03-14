import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Heart, ArrowLeft, Car } from 'lucide-react';
import { supabase, Listing } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import BackButton from '../components/BackButton';


export default function Search() {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [listings, setListings] = useState<Listing[]>([]);
  const [filteredListings, setFilteredListings] = useState<Listing[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const [cityFilter, setCityFilter] = useState('');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState(searchParams.get('type') || '');
  const [maxPrice, setMaxPrice] = useState('');
  const [minBedrooms, setMinBedrooms] = useState('');
  const [minGuests, setMinGuests] = useState(searchParams.get('guests') || '');

  useEffect(() => {
    loadListings();
    if (profile?.role === 'student') {
      loadFavorites();
    }
  }, [profile]);

  useEffect(() => {
    applyFilters();
  }, [listings, cityFilter, propertyTypeFilter, maxPrice, minBedrooms, minGuests]);


  const loadListings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('listings')
      .select(`
        *,
        landlord:profiles!landlord_id(first_name, last_name),
        images:listing_images(*)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setListings(data);
    }
    setLoading(false);
  };

  const loadFavorites = async () => {
    const { data } = await supabase
      .from('favorites')
      .select('listing_id')
      .eq('student_id', profile?.id || '');

    if (data) {
      setFavorites(new Set(data.map((f) => f.listing_id)));
    }
  };

  const applyFilters = () => {
    let filtered = [...listings];

    if (cityFilter) {
      filtered = filtered.filter((l) =>
        l.city.toLowerCase().includes(cityFilter.toLowerCase())
      );
    }

    if (propertyTypeFilter) {
      filtered = filtered.filter((l) => l.property_type === propertyTypeFilter);
    }

    if (maxPrice) {
      filtered = filtered.filter((l) => l.price_per_month <= parseFloat(maxPrice));
    }

    if (minBedrooms) {
      filtered = filtered.filter((l) => l.bedrooms >= parseInt(minBedrooms));
    }

    if (minGuests) {
      filtered = filtered.filter((l) => l.max_guests >= parseInt(minGuests));
    }

    setFilteredListings(filtered);
  };

  const toggleFavorite = async (listingId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (profile?.role !== 'student') return;

    const isFavorite = favorites.has(listingId);

    if (isFavorite) {
      await supabase
        .from('favorites')
        .delete()
        .eq('student_id', profile.id)
        .eq('listing_id', listingId);

      setFavorites((prev) => {
        const newSet = new Set(prev);
        newSet.delete(listingId);
        return newSet;
      });
    } else {
      await supabase.from('favorites').insert({
        student_id: profile.id,
        listing_id: listingId,
      });

      setFavorites((prev) => new Set([...prev, listingId]));
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 bg-white sticky top-20 z-40">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-20 py-4 flex items-center gap-4">
          <BackButton />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-6 py-3 border border-gray-300 rounded-full hover:border-gray-900 transition text-sm font-medium"
          >
            {t('search.filters')}
          </button>

          {showFilters && (
            <div className="absolute left-0 right-0 bg-white border-t border-gray-200 shadow-xl p-6 mt-4">
              <div className="max-w-screen-2xl mx-auto px-6 lg:px-20">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      {t('search.city')}
                    </label>
                    <input
                      type="text"
                      value={cityFilter}
                      onChange={(e) => setCityFilter(e.target.value)}
                      placeholder="Fontainebleau"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      {t('search.propertyType')}
                    </label>
                    <select
                      value={propertyTypeFilter}
                      onChange={(e) => setPropertyTypeFilter(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition"
                    >
                      <option value="">🏘️ {t('search.propertyType.all')}</option>
                      <option value="apartment">🏢 {t('search.propertyType.apartment')}</option>
                      <option value="house">🏠 {t('search.propertyType.house')}</option>
                      <option value="room">🛏️ {t('search.propertyType.room')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      {t('search.priceRange')}
                    </label>
                    <input
                      type="number"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      placeholder="1000"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      {t('search.bedrooms')}
                    </label>
                    <input
                      type="number"
                      value={minBedrooms}
                      onChange={(e) => setMinBedrooms(e.target.value)}
                      placeholder="1"
                      min="0"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      {t('search.guests')}
                    </label>
                    <input
                      type="number"
                      value={minGuests}
                      onChange={(e) => setMinGuests(e.target.value)}
                      placeholder="1"
                      min="1"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 lg:px-20 py-10">
        <div className="mb-6">
          <p className="text-sm text-gray-600">
            {filteredListings.length} {language === 'fr' ? (filteredListings.length === 1 ? 'logement' : 'logements') : (filteredListings.length === 1 ? 'listing' : 'listings')}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-gray-600">{t('search.noResults')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredListings.map((listing) => (
              <div
                key={listing.id}
                className="group cursor-pointer"
                onClick={() => navigate(`/logement/${listing.id}`)}
              >
                <div className="relative aspect-square mb-3 rounded-xl overflow-hidden">
                  {listing.images && listing.images.length > 0 ? (
                    <img
                      src={listing.images[0].image_url}
                      alt={listing.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-400">{language === 'fr' ? "Pas d'image" : 'No image'}</span>
                    </div>
                  )}

                  {profile?.role === 'student' && (
                    <button
                      onClick={(e) => toggleFavorite(listing.id, e)}
                      className="absolute top-3 right-3 p-2 hover:scale-110 transition-transform"
                    >
                      <Heart
                        className={`h-6 w-6 ${
                          favorites.has(listing.id)
                            ? 'fill-rose-500 text-rose-500'
                            : 'fill-white/70 text-white stroke-white/70 stroke-2'
                        }`}
                      />
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 truncate pr-2">
                      {listing.city}
                    </h3>
                    {listing.insead_distance_text && listing.insead_duration_text ? (
                      <div className="flex items-center gap-1 text-xs font-medium text-[#1e3a5f] flex-shrink-0">
                        <Car className="h-3 w-3" />
                        <span>{listing.insead_distance_text} · {listing.insead_duration_text}</span>
                      </div>
                    ) : null}
                  </div>

                  <p className="text-gray-600 text-sm truncate">{listing.title}</p>

                  <p className="text-gray-600 text-sm">
                    {listing.bedrooms} {language === 'fr' ? (listing.bedrooms === 1 ? 'chambre' : 'chambres') : (listing.bedrooms === 1 ? 'bedroom' : 'bedrooms')} · {listing.max_guests} {language === 'fr' ? (listing.max_guests === 1 ? 'voyageur' : 'voyageurs') : (listing.max_guests === 1 ? 'guest' : 'guests')}
                    {listing.apartment_area ? ` · ${Math.round(Number(listing.apartment_area))} m²` : ''}
                    {listing.floor != null ? ` · ${listing.floor === 0 ? (language === 'fr' ? 'RDC' : 'GF') : `${listing.floor}${language === 'fr' ? 'e ét.' : (listing.floor === 1 ? 'st' : listing.floor === 2 ? 'nd' : listing.floor === 3 ? 'rd' : 'th') + ' fl.'}`}` : ''}
                  </p>

                  <div className="pt-1">
                    <span className="font-semibold text-gray-900">{listing.price_per_month}€</span>
                    <span className="text-gray-600 text-sm"> {t('listing.perMonth')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
