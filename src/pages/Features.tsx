import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import DetailedFeatureSection from '../components/DetailedFeatureSection';
import SEO from '../components/SEO';
import { Loader2, GraduationCap, Home, Layers } from 'lucide-react';
import BackButton from '../components/BackButton';

interface FeatureData {
  id: string;
  title_fr: string;
  title_en: string;
  description_fr?: string;
  description_en?: string;
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
  user_type: string;
}

type UserType = 'both' | 'student' | 'landlord';

export default function Features() {
  const { language } = useLanguage();
  const [features, setFeatures] = useState<FeatureData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<UserType>('both');
  const fr = language === 'fr';

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

      const filteredData = (data || []).filter(f =>
        f.title_fr || f.title_en || f.detailed_title_fr || f.detailed_title_en
      );

      setFeatures(filteredData);
    } catch (error) {
      console.error('Error loading features:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterButtons = [
    { type: 'both' as UserType, labelFr: 'Toutes', labelEn: 'All', icon: Layers },
    { type: 'student' as UserType, labelFr: 'Étudiants', labelEn: 'Students', icon: GraduationCap },
    { type: 'landlord' as UserType, labelFr: 'Propriétaires', labelEn: 'Landlords', icon: Home },
  ];

  return (
    <>
      <SEO
        title={fr ? 'Toutes nos fonctionnalités' : 'All our features'}
        description={
          fr
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

        {/* Hero */}
        <div className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-rose-950 text-white py-20 sm:py-28 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute top-20 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-10 left-1/3 w-80 h-80 bg-rose-400/5 rounded-full blur-3xl"></div>
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-rose-100 to-pink-100 bg-clip-text text-transparent">
              {fr ? 'Toutes nos fonctionnalités' : 'All our features'}
            </h1>
            <p className="text-lg sm:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed mb-10">
              {fr
                ? 'Une plateforme complète conçue pour simplifier la location entre étudiants INSEAD et propriétaires à Fontainebleau.'
                : 'A complete platform designed to simplify rentals between INSEAD students and landlords in Fontainebleau.'}
            </p>

            {/* Filter buttons */}
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
              {filterButtons.map(({ type, labelFr, labelEn, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-full font-semibold text-sm sm:text-base transition-all duration-300 ${
                    selectedType === type
                      ? 'bg-white text-gray-900 shadow-lg scale-105'
                      : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm border border-white/20'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {fr ? labelFr : labelEn}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white py-20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
          </div>
        ) : (
          <>
            {features.length > 0 && (
              <div className="bg-white py-4">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <p className="text-center text-sm text-gray-500 pt-8">
                    {fr
                      ? `${features.length} fonctionnalité${features.length > 1 ? 's' : ''} disponible${features.length > 1 ? 's' : ''}`
                      : `${features.length} feature${features.length > 1 ? 's' : ''} available`}
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white">
              {features.map((feature, index) => {
                const title = fr
                  ? (feature.detailed_title_fr || feature.title_fr || '')
                  : (feature.detailed_title_en || feature.title_en || '');

                const description = fr
                  ? (feature.detailed_description_fr || feature.description_fr || '')
                  : (feature.detailed_description_en || feature.description_en || '');

                const ctaText = fr ? feature.cta_text_fr : feature.cta_text_en;

                const featureItems = feature.features?.map(f => ({
                  icon: f.icon,
                  text: fr ? f.text_fr : f.text_en
                })) || [];

                const accent = feature.user_type === 'landlord' ? 'rose' : 'blue';

                return (
                  <DetailedFeatureSection
                    key={feature.id}
                    title={title}
                    description={description}
                    features={featureItems}
                    imageUrl={feature.image_url}
                    videoUrl={feature.video_url}
                    ctaText={ctaText || undefined}
                    ctaUrl={feature.cta_url || undefined}
                    reverse={index % 2 === 1}
                    accent={accent as 'blue' | 'rose'}
                  />
                );
              })}
            </div>

            {features.length === 0 && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center bg-white">
                <p className="text-gray-500">
                  {fr
                    ? 'Aucune fonctionnalité disponible pour ce filtre.'
                    : 'No features available for this filter.'}
                </p>
              </div>
            )}
          </>
        )}

        {/* Bottom CTA */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold mb-4">
              {fr ? 'Prêt à commencer ?' : 'Ready to get started?'}
            </h2>
            <p className="text-gray-300 mb-8 text-lg">
              {fr
                ? 'Rejoignez notre communauté et simplifiez votre expérience locative à Fontainebleau.'
                : 'Join our community and simplify your rental experience in Fontainebleau.'}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="/recherche"
                className="inline-flex items-center gap-2 bg-white text-gray-900 px-8 py-3.5 rounded-xl font-semibold hover:bg-gray-100 transition-colors shadow-lg"
              >
                <GraduationCap className="w-5 h-5" />
                {fr ? 'Trouver un logement' : 'Find accommodation'}
              </a>
              <a
                href="/inscription"
                className="inline-flex items-center gap-2 bg-rose-600 text-white px-8 py-3.5 rounded-xl font-semibold hover:bg-rose-700 transition-colors shadow-lg"
              >
                <Home className="w-5 h-5" />
                {fr ? 'Publier une annonce' : 'Publish a listing'}
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
