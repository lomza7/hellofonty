import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Heart, MessageCircle, Lock, Home as HomeIcon, Calendar, FileText, Key, CheckCircle, Search, Star, Users, CreditCard, BarChart3, FileSignature, Banknote, ClipboardCheck } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import SearchBar, { SearchFilters } from '../components/SearchBar';
import OptimizedImage from '../components/OptimizedImage';
import FeaturedListings from '../components/FeaturedListings';
import PlatformStats from '../components/PlatformStats';
import FeaturesCarousel from '../components/FeaturesCarousel';
import FAQ from '../components/FAQ';

interface FeatureImage {
  feature_key: string;
  image_url: string;
  display_order: number;
  title_fr?: string;
  title_en?: string;
  description_fr?: string;
  description_en?: string;
}

export default function Home() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [landlordFeatures, setLandlordFeatures] = useState<FeatureImage[]>([]);
  const [studentFeatures, setStudentFeatures] = useState<FeatureImage[]>([]);

  useEffect(() => {
    loadFeatureImages();
  }, []);

  async function loadFeatureImages() {
    try {
      const { data, error } = await supabase
        .from('feature_carousel_images')
        .select('feature_key, image_url, display_order, title_fr, title_en, description_fr, description_en')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;

      const landlords = data?.filter(item => item.feature_key.startsWith('landlords.')) || [];
      const students = data?.filter(item => item.feature_key.startsWith('students.')) || [];

      setLandlordFeatures(landlords);
      setStudentFeatures(students);
    } catch (error) {
      console.error('Error loading feature images:', error);
    }
  }

  const handleSearch = (filters: SearchFilters) => {
    console.log('Search filters:', filters);
    navigate('/recherche');
  };

  const getIconForFeature = (featureKey: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      'landlords.lease': <FileSignature className="w-7 h-7" />,
      'landlords.payment': <Banknote className="w-7 h-7" />,
      'landlords.inventory': <ClipboardCheck className="w-7 h-7" />,
      'landlords.listings': <HomeIcon className="w-7 h-7" />,
      'landlords.bookings': <Calendar className="w-7 h-7" />,
      'landlords.access': <Key className="w-7 h-7" />,
      'landlords.verification': <CheckCircle className="w-7 h-7" />,
      'landlords.messaging': <MessageCircle className="w-7 h-7" />,
      'landlords.stats': <BarChart3 className="w-7 h-7" />,
      'students.search': <Search className="w-7 h-7" />,
      'students.verified': <Shield className="w-7 h-7" />,
      'students.favorites': <Heart className="w-7 h-7" />,
      'students.booking': <Calendar className="w-7 h-7" />,
      'students.documents': <FileText className="w-7 h-7" />,
      'students.access': <Key className="w-7 h-7" />,
      'students.community': <Users className="w-7 h-7" />,
      'students.free': <Star className="w-7 h-7" />
    };
    return iconMap[featureKey] || <HomeIcon className="w-7 h-7" />;
  };

  const getFeatureTitle = (feature: FeatureImage, fallbackKey: string) => {
    const customTitle = language === 'en' ? feature.title_en : feature.title_fr;
    if (customTitle) return customTitle;

    const translation = t(fallbackKey);
    if (translation && translation !== fallbackKey) {
      return translation;
    }

    return feature.feature_key.split('.')[1].replace(/_/g, ' ');
  };

  const getFeatureDescription = (feature: FeatureImage, fallbackKey: string) => {
    const customDesc = language === 'en' ? feature.description_en : feature.description_fr;
    if (customDesc) return customDesc;

    const translation = t(fallbackKey);
    if (translation && translation !== fallbackKey) {
      return translation;
    }

    return '';
  };

  const renderGradientText = (text: string) => {
    const letters = text.split('');
    return letters.map((letter, index) => {
      const progress = index / (letters.length - 1);
      const lightness = 100 - (progress * 25);
      const saturation = progress * 70;
      const hue = 350;

      return (
        <span
          key={index}
          style={{
            color: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
            textShadow: '0 3px 12px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.3)',
          }}
        >
          {letter}
        </span>
      );
    });
  };

  return (
    <div className="min-h-screen">
      <div
        className="relative min-h-[700px] sm:min-h-[650px] bg-cover bg-center"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url(/442_CI_200703_forest_08.jpg)',
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center py-6 sm:py-16">
          <div className="w-full px-3 sm:px-6 max-w-5xl overflow-hidden">
            <div className="flex justify-center mb-4 sm:mb-6">
              <div className="inline-flex items-center gap-2 px-3 sm:px-6 py-1.5 sm:py-3 bg-white/10 backdrop-blur-md border-2 border-white/30 rounded-full hover:bg-white/20 hover:border-white/40 transition-all duration-300 cursor-pointer group">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-white font-semibold text-xs sm:text-sm tracking-wide uppercase group-hover:tracking-wider transition-all">
                  For INSEAD Only
                </span>
              </div>
            </div>

            <h1 className="text-4xl sm:text-6xl md:text-8xl font-bold mb-3 sm:mb-4 tracking-tight text-center leading-tight px-2">
              {renderGradientText(t('home.hero.title'))}
            </h1>
            <p className="text-xs sm:text-lg md:text-xl text-white mb-5 sm:mb-8 font-light text-center px-4">
              {t('home.hero.subtitle')}
            </p>

            <div className="max-w-4xl mx-auto px-2 sm:px-0 overflow-hidden">
              <SearchBar onSearch={handleSearch} />
            </div>

            <p className="text-center text-white/90 text-xs sm:text-sm mt-4 sm:mt-6 px-4">
              {t('home.hero.verified')}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 py-12 sm:py-16">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-20">
          <PlatformStats />
        </div>
      </div>

      <FeaturedListings />

{landlordFeatures.length > 0 && (
        <FeaturesCarousel
          title={t('features.landlords.title')}
          subtitle={t('features.landlords.subtitle')}
          accentColor="rose"
          features={landlordFeatures.map(feature => ({
            icon: getIconForFeature(feature.feature_key),
            title: getFeatureTitle(feature, `features.landlords.${feature.feature_key.split('.')[1]}.title`),
            description: getFeatureDescription(feature, `features.landlords.${feature.feature_key.split('.')[1]}.desc`),
            imageUrl: feature.image_url
          }))}
        />
      )}

{studentFeatures.length > 0 && (
        <FeaturesCarousel
          title={t('features.students.title')}
          subtitle={t('features.students.subtitle')}
          accentColor="blue"
          features={studentFeatures.map(feature => ({
            icon: getIconForFeature(feature.feature_key),
            title: getFeatureTitle(feature, `features.students.${feature.feature_key.split('.')[1]}.title`),
            description: getFeatureDescription(feature, `features.students.${feature.feature_key.split('.')[1]}.desc`),
            imageUrl: feature.image_url
          }))}
        />
      )}

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-20 py-12 sm:py-20">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 mb-3 sm:mb-4 text-center">
          {t('home.howItWorks')}
        </h2>
        <p className="text-center text-gray-600 text-base sm:text-lg mb-10 sm:mb-16 max-w-3xl mx-auto">
          {t('home.secureplatform')}
        </p>


        <div className="mt-12 sm:mt-20 grid md:grid-cols-2 gap-8 sm:gap-16 items-center">
          <div>
            <div className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 bg-rose-100 text-rose-700 rounded-full text-xs sm:text-sm font-semibold mb-4 sm:mb-6">
              {t('home.forStudents')}
            </div>
            <h3 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4 sm:mb-6">
              {t('home.students.title')}
            </h3>
            <p className="text-gray-600 text-base sm:text-lg leading-relaxed mb-6 sm:mb-8">
              {t('home.forStudents.desc')}
            </p>

            <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
              {[
                { num: '1', text: t('home.step1') },
                { num: '2', text: t('home.step2') },
                { num: '3', text: t('home.step3') },
                { num: '4', text: t('home.step4') },
                { num: '5', text: t('home.step5') }
              ].map((step) => (
                <div key={step.num} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-rose-500 text-white rounded-full flex items-center justify-center text-sm sm:text-base font-semibold">
                    {step.num}
                  </div>
                  <p className="text-gray-700 text-sm sm:text-base pt-1">{step.text}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate(user ? '/recherche' : '/inscription')}
              className="px-6 py-3 sm:px-8 sm:py-4 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition font-medium text-sm sm:text-base"
            >
              {user ? t('nav.search') : t('nav.signUp')}
            </button>
          </div>
          <OptimizedImage
            src="/Etat_lieux_AdobeStock_897x505.jpg"
            alt="Student housing"
            className="h-64 sm:h-96 w-full object-cover rounded-2xl sm:rounded-3xl shadow-2xl"
          />
        </div>

        <div className="mt-12 sm:mt-20 grid md:grid-cols-2 gap-8 sm:gap-16 items-center">
          <OptimizedImage
            src="/beymedias.brightspotcdn copy.jpg"
            alt="Landlord dashboard"
            className="h-64 sm:h-96 w-full object-cover rounded-2xl sm:rounded-3xl shadow-2xl order-2 md:order-1"
          />
          <div className="order-1 md:order-2">
            <div className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 bg-rose-100 text-rose-700 rounded-full text-xs sm:text-sm font-semibold mb-4 sm:mb-6">
              {t('home.forLandlords')}
            </div>
            <h3 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-4 sm:mb-6">
              {t('home.landlords.title')}
            </h3>
            <p className="text-gray-600 text-base sm:text-lg leading-relaxed mb-6 sm:mb-8">
              {t('home.forLandlords.desc')}
            </p>

            <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
              {[
                { num: '1', text: t('home.step.landlord.1') },
                { num: '2', text: t('home.step.landlord.2') },
                { num: '3', text: t('home.step.landlord.3') },
                { num: '4', text: t('home.step.landlord.4') },
                { num: '5', text: t('home.step.landlord.5') }
              ].map((step) => (
                <div key={step.num} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 bg-rose-500 text-white rounded-full flex items-center justify-center text-sm sm:text-base font-semibold">
                    {step.num}
                  </div>
                  <p className="text-gray-700 text-sm sm:text-base pt-1">{step.text}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate(user ? '/ajouter-annonce' : '/inscription')}
              className="px-6 py-3 sm:px-8 sm:py-4 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition font-medium text-sm sm:text-base"
            >
              {user ? t('nav.addListing') : t('nav.signUp')}
            </button>
          </div>
        </div>
      </div>

      <FAQ />

      <div className="bg-gray-50 py-12 sm:py-20 mt-12 sm:mt-20">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-20 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 mb-4 sm:mb-6">
            {t('home.cta.title')}
          </h2>
          <p className="text-gray-600 text-base sm:text-lg mb-8 sm:mb-10">
            {t('home.cta.subtitle')}
          </p>
          <button
            onClick={() => navigate('/inscription')}
            className="px-8 py-4 sm:px-10 sm:py-5 bg-rose-500 text-white text-base sm:text-lg font-semibold rounded-full hover:bg-rose-600 transform active:scale-95 sm:hover:scale-105 transition-all shadow-xl"
          >
            {t('nav.signUp')}
          </button>
        </div>
      </div>
    </div>
  );
}
