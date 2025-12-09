import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ListingCard from './ListingCard';
import InteractiveMap from './InteractiveMap';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

type Listing = {
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

export default function FeaturedListings() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    fetchListings();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      handleScroll();
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [listings]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      const newScrollLeft = scrollContainerRef.current.scrollLeft + (direction === 'right' ? scrollAmount : -scrollAmount);
      scrollContainerRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      });
    }
  };

  const fetchListings = async () => {
    try {
      const { data: listingsData, error: listingsError } = await supabase
        .from('listings')
        .select(`
          id,
          title,
          address,
          city,
          property_type,
          price_per_month,
          bedrooms,
          bathrooms,
          bonus_features,
          listing_images(image_url)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(6);

      if (listingsError) throw listingsError;

      if (listingsData) {
        const listingsWithImages = listingsData.map((listing: any) => ({
          id: listing.id,
          title: listing.title,
          address: listing.address,
          city: listing.city,
          property_type: listing.property_type,
          price_per_month: listing.price_per_month,
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          image_url: listing.listing_images?.[0]?.image_url,
          bonus_features: listing.bonus_features,
        }));

        setListings(listingsWithImages);
      }
    } catch (error) {
      console.error('Error fetching listings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-20">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-200 h-64 rounded-2xl mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (listings.length === 0) {
    return null;
  }

  return (
    <div className="py-20 bg-white">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-20">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-3">
              {t('home.featured.title')}
            </h2>
            <p className="text-gray-600 text-lg">
              {t('home.featured.subtitle')}
            </p>
          </div>
          <button
            onClick={() => navigate('/recherche')}
            className="hidden md:flex items-center space-x-2 px-6 py-3 text-rose-600 hover:text-rose-700 font-medium group"
          >
            <span>Voir tout</span>
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="relative">
          {canScrollLeft && (
            <button
              onClick={() => scroll('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-3 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-all -translate-x-1/2"
              aria-label="Défiler vers la gauche"
            >
              <ChevronLeft className="h-6 w-6 text-gray-700" />
            </button>
          )}

          {canScrollRight && (
            <button
              onClick={() => scroll('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-3 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-all translate-x-1/2"
              aria-label="Défiler vers la droite"
            >
              <ChevronRight className="h-6 w-6 text-gray-700" />
            </button>
          )}

          <div
            ref={scrollContainerRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {listings.map((listing) => (
              <div key={listing.id} className="flex-shrink-0 w-[280px] sm:w-[320px]">
                <ListingCard
                  listing={listing}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center md:hidden">
          <button
            onClick={() => navigate('/recherche')}
            className="inline-flex items-center space-x-2 px-8 py-4 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition font-medium"
          >
            <span>{t('home.viewAllListings')}</span>
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>

        {/* Interactive Map Section */}
        <div className="mt-20">
          <div className="text-center mb-12">
            <div className="flex justify-center mb-8">
              <img
                src="/google_gemini_generated_image.png"
                alt="Communauté INSEAD"
                className="max-w-4xl w-full h-auto rounded-2xl shadow-lg"
              />
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-3">
              {t('home.map.title')}
            </h2>
            <p className="text-gray-600 text-lg">
              {t('home.map.subtitle')}
            </p>
          </div>

          <InteractiveMap />
        </div>
      </div>
    </div>
  );
}
