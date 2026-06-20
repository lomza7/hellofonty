import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, BadgeCheck, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PartnerOffer {
  id: string;
  title: string;
  description: string;
  company_name: string;
  image_url: string | null;
  cta_text: string;
  cta_link: string;
  verified: boolean;
  display_order: number;
}

interface PartnerOffersCarouselProps {
  targetAudience: 'landlord' | 'student';
}

export default function PartnerOffersCarousel({ targetAudience }: PartnerOffersCarouselProps) {
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    fetchOffers();
  }, [targetAudience]);

  const fetchOffers = async () => {
    try {
      const { data, error } = await supabase
        .from('partner_offers')
        .select('*')
        .eq('is_active', true)
        .in('target_audience', [targetAudience, 'both'])
        .order('display_order', { ascending: true });

      if (error) throw error;
      setOffers(data || []);
    } catch (error) {
      console.error('Error fetching partner offers:', error);
    } finally {
      setLoading(false);
    }
  };

  const nextSlide = () => {
    if (isAnimating || offers.length === 0) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev + 1) % offers.length);
    setTimeout(() => setIsAnimating(false), 500);
  };

  const prevSlide = () => {
    if (isAnimating || offers.length === 0) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev - 1 + offers.length) % offers.length);
    setTimeout(() => setIsAnimating(false), 500);
  };

  const goToSlide = (index: number) => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex(index);
    setTimeout(() => setIsAnimating(false), 500);
  };

  useEffect(() => {
    if (offers.length <= 1) return;

    const interval = setInterval(() => {
      nextSlide();
    }, 6000);

    return () => clearInterval(interval);
  }, [offers.length, currentIndex, nextSlide]);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-rose-50 to-blue-50 rounded-2xl p-6 animate-pulse">
        <div className="h-48 bg-gray-200 rounded-xl"></div>
      </div>
    );
  }

  if (offers.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-rose-50 via-white to-blue-50 rounded-2xl shadow-lg overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BadgeCheck className="h-6 w-6 text-rose-500" />
            Offres Partenaires Vérifiées
          </h2>
          <span className="text-xs font-medium text-gray-500 bg-white px-3 py-1 rounded-full">
            Sponsorisé
          </span>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-xl bg-white shadow-md">
            <div
              className="transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
              <div className="flex">
                {offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="w-full flex-shrink-0"
                  >
                    <div className="flex flex-col md:flex-row">
                      {offer.image_url && (
                        <div className="md:w-1/3 h-48 md:h-auto bg-gradient-to-br from-rose-100 to-blue-100">
                          <img
                            src={offer.image_url}
                            alt={offer.company_name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className={`${offer.image_url ? 'md:w-2/3' : 'w-full'} p-6`}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">
                              {offer.title}
                            </h3>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-rose-600">
                                {offer.company_name}
                              </span>
                              {offer.verified && (
                                <BadgeCheck className="h-4 w-4 text-blue-500" />
                              )}
                            </div>
                          </div>
                        </div>

                        <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                          {offer.description}
                        </p>

                        <a
                          href={offer.cta_link}
                          target={offer.cta_link.startsWith('http') ? '_blank' : '_self'}
                          rel={offer.cta_link.startsWith('http') ? 'noopener noreferrer' : undefined}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-medium transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                        >
                          {offer.cta_text}
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {offers.length > 1 && (
            <>
              <button
                onClick={prevSlide}
                disabled={isAnimating}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed z-10"
                aria-label="Offre précédente"
              >
                <ChevronLeft className="h-5 w-5 text-gray-700" />
              </button>

              <button
                onClick={nextSlide}
                disabled={isAnimating}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed z-10"
                aria-label="Offre suivante"
              >
                <ChevronRight className="h-5 w-5 text-gray-700" />
              </button>

              <div className="flex justify-center gap-2 mt-4">
                {offers.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToSlide(index)}
                    disabled={isAnimating}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === currentIndex
                        ? 'w-8 bg-rose-500'
                        : 'w-2 bg-gray-300 hover:bg-gray-400'
                    }`}
                    aria-label={`Aller à l'offre ${index + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
