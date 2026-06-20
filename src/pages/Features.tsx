import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import DetailedFeatureSection from '../components/DetailedFeatureSection';
import SEO from '../components/SEO';
import { Loader2 } from 'lucide-react';
import BackButton from '../components/BackButton';

interface FeatureData {
  id: string;
  title_fr: string;
  title_en: string;
  description_fr?: string;
  description_en?: string;
  text_fr: string;
  text_en: string;
  image_url: string;
  detailed_title_fr?: string;
  detailed_title_en?: string;
  detailed_description_fr?: string;
  detailed_description_en?: string;
  features?: Array<{
    icon: string;
    text_fr: string;
    text_en: string;
  }>;
  video_url?: string;
  cta_text_fr?: string;
  cta_text_en?: string;
  cta_url?: string;
  display_order: number;
}

type UserType = 'both' | 'student' | 'landlord';

export default function Features() {
  const { language } = useLanguage();
  const [features, setFeatures] = useState<FeatureData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<UserType>('both');

  useEffect(() => {
    loadFeatures();
  }, [selectedType]);

  const loadFeatures = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('feature_carousel_images')
        .select('*')
        .eq('is_active', true);

      if (selectedType !== 'both') {
        query = query.or(`user_type.eq.${selectedType},user_type.eq.both`);
      }

      const { data, error } = await query.order('display_order', { ascending: true });

      if (error) throw error;

      setFeatures(data || []);
    } catch (error) {
      console.error('Error loading features:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEO
        title={language === 'fr' ? 'Toutes nos fonctionnalités' : 'All our features'}
        description={
          language === 'fr'
            ? 'Découvrez toutes les fonctionnalités de notre plateforme de location étudiante à Fontainebleau'
            : 'Discover all the features of our student rental platform in Fontainebleau'
        }
      />

      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <BackButton />
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-rose-950 text-white py-20 sm:py-28 overflow-hidden">
          {/* Decorative background circles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute top-20 -right-40 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-rose-400/5 rounded-full blur-3xl"></div>
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-rose-100 to-pink-100 bg-clip-text text-transparent">
              {language === 'fr' ? 'Toutes nos fonctionnalités' : 'All our features'}
            </h1>
            <p className="text-lg sm:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed mb-10">
              {language === 'fr'
                ? 'Découvrez comment notre plateforme facilite la location étudiante à Fontainebleau'
                : 'Discover how our platform makes student rentals in Fontainebleau easy'}
            </p>

            <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
              <button
                onClick={() => setSelectedType('both')}
                className={`px-6 sm:px-8 py-3 sm:py-3.5 rounded-full font-semibold text-sm sm:text-base transition-all duration-300 ${
                  selectedType === 'both'
                    ? 'bg-white text-gray-900 shadow-lg scale-105'
                    : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm border border-white/20'
                }`}
              >
                {language === 'fr' ? 'Toutes' : 'All'}
              </button>
              <button
                onClick={() => setSelectedType('student')}
                className={`px-6 sm:px-8 py-3 sm:py-3.5 rounded-full font-semibold text-sm sm:text-base transition-all duration-300 ${
                  selectedType === 'student'
                    ? 'bg-white text-gray-900 shadow-lg scale-105'
                    : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm border border-white/20'
                }`}
              >
                {language === 'fr' ? 'Étudiants' : 'Students'}
              </button>
              <button
                onClick={() => setSelectedType('landlord')}
                className={`px-6 sm:px-8 py-3 sm:py-3.5 rounded-full font-semibold text-sm sm:text-base transition-all duration-300 ${
                  selectedType === 'landlord'
                    ? 'bg-white text-gray-900 shadow-lg scale-105'
                    : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm border border-white/20'
                }`}
              >
                {language === 'fr' ? 'Propriétaires' : 'Landlords'}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white py-20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
          </div>
        ) : (
          <>
            <div className="bg-white">
              {features.map((feature, index) => {
                const title = language === 'fr'
                  ? (feature.detailed_title_fr || feature.title_fr || '')
                  : (feature.detailed_title_en || feature.title_en || '');

                const description = language === 'fr'
                  ? (feature.detailed_description_fr || feature.description_fr || '')
                  : (feature.detailed_description_en || feature.description_en || '');

                const ctaText = language === 'fr' ? feature.cta_text_fr : feature.cta_text_en;

                const featureItems = feature.features?.map(f => ({
                  icon: f.icon,
                  text: language === 'fr' ? f.text_fr : f.text_en
                })) || [];

                return (
                  <DetailedFeatureSection
                    key={feature.id}
                    title={title}
                    description={description}
                    features={featureItems}
                    imageUrl={feature.image_url}
                    videoUrl={feature.video_url}
                    ctaText={ctaText}
                    ctaUrl={feature.cta_url}
                    reverse={index % 2 === 1}
                  />
                );
              })}
            </div>

            {features.length === 0 && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center bg-white">
                <p className="text-gray-500">
                  {language === 'fr'
                    ? 'Aucune fonctionnalité détaillée disponible pour le moment.'
                    : 'No detailed features available at the moment.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
