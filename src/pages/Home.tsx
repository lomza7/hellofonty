import { useState, useEffect } from 'react';
import { Shield, Heart, MessageCircle, Lock, Home as HomeIcon, Calendar, FileText, Key, CheckCircle, Search, Star, Users, CreditCard, BarChart3, FileSignature, Banknote, ClipboardCheck } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import SearchBar, { SearchFilters } from '../components/SearchBar';
import OptimizedImage from '../components/OptimizedImage';
import FeaturedListings from '../components/FeaturedListings';
import PlatformStats from '../components/PlatformStats';
import FeaturesCarousel from '../components/FeaturesCarousel';

type HomeProps = {
  onNavigate: (page: string, listingId?: string) => void;
};

interface FeatureImage {
  feature_key: string;
  image_url: string;
}

export default function Home({ onNavigate }: HomeProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [featureImages, setFeatureImages] = useState<Record<string, string>>({});
  const [activeFeatureKeys, setActiveFeatureKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFeatureImages();
  }, []);

  async function loadFeatureImages() {
    try {
      const { data, error } = await supabase
        .from('feature_carousel_images')
        .select('feature_key, image_url')
        .eq('is_active', true);

      if (error) throw error;

      const imageMap: Record<string, string> = {};
      const activeKeys = new Set<string>();
      data?.forEach((item: FeatureImage) => {
        imageMap[item.feature_key] = item.image_url;
        activeKeys.add(item.feature_key);
      });
      setFeatureImages(imageMap);
      setActiveFeatureKeys(activeKeys);
    } catch (error) {
      console.error('Error loading feature images:', error);
    }
  }

  const handleSearch = (filters: SearchFilters) => {
    console.log('Search filters:', filters);
    onNavigate('search');
  };

  const getFeatureImage = (key: string, fallback: string) => {
    return featureImages[key] || fallback;
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

            <h1 className="text-3xl sm:text-6xl md:text-8xl font-bold mb-3 sm:mb-4 tracking-tight text-center leading-tight px-2">
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

      <FeaturedListings onNavigate={onNavigate} />

{(() => {
        const landlordFeatures = [
          {
            key: 'landlords.lease',
            icon: <FileSignature className="w-7 h-7" />,
            title: t('features.landlords.lease.title'),
            description: t('features.landlords.lease.desc'),
            imageUrl: getFeatureImage('landlords.lease', 'https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg')
          },
          {
            key: 'landlords.payment',
            icon: <Banknote className="w-7 h-7" />,
            title: t('features.landlords.payment.title'),
            description: t('features.landlords.payment.desc'),
            imageUrl: getFeatureImage('landlords.payment', 'https://images.pexels.com/photos/4968630/pexels-photo-4968630.jpeg')
          },
          {
            key: 'landlords.inventory',
            icon: <ClipboardCheck className="w-7 h-7" />,
            title: t('features.landlords.inventory.title'),
            description: t('features.landlords.inventory.desc'),
            imageUrl: getFeatureImage('landlords.inventory', 'https://images.pexels.com/photos/7078666/pexels-photo-7078666.jpeg')
          },
          {
            key: 'landlords.listings',
            icon: <HomeIcon className="w-7 h-7" />,
            title: t('features.landlords.listings.title'),
            description: t('features.landlords.listings.desc'),
            imageUrl: getFeatureImage('landlords.listings', 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg')
          },
          {
            key: 'landlords.bookings',
            icon: <Calendar className="w-7 h-7" />,
            title: t('features.landlords.bookings.title'),
            description: t('features.landlords.bookings.desc'),
            imageUrl: getFeatureImage('landlords.bookings', 'https://images.pexels.com/photos/5717546/pexels-photo-5717546.jpeg')
          },
          {
            key: 'landlords.access',
            icon: <Key className="w-7 h-7" />,
            title: t('features.landlords.access.title'),
            description: t('features.landlords.access.desc'),
            imageUrl: getFeatureImage('landlords.access', 'https://images.pexels.com/photos/5705471/pexels-photo-5705471.jpeg')
          },
          {
            key: 'landlords.verification',
            icon: <CheckCircle className="w-7 h-7" />,
            title: t('features.landlords.verification.title'),
            description: t('features.landlords.verification.desc'),
            imageUrl: getFeatureImage('landlords.verification', 'https://images.pexels.com/photos/5668838/pexels-photo-5668838.jpeg')
          },
          {
            key: 'landlords.messaging',
            icon: <MessageCircle className="w-7 h-7" />,
            title: t('features.landlords.messaging.title'),
            description: t('features.landlords.messaging.desc'),
            imageUrl: getFeatureImage('landlords.messaging', 'https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg')
          },
          {
            key: 'landlords.stats',
            icon: <BarChart3 className="w-7 h-7" />,
            title: t('features.landlords.stats.title'),
            description: t('features.landlords.stats.desc'),
            imageUrl: getFeatureImage('landlords.stats', 'https://images.pexels.com/photos/7947664/pexels-photo-7947664.jpeg')
          }
        ].filter(feature => activeFeatureKeys.size === 0 || activeFeatureKeys.has(feature.key));

        return landlordFeatures.length > 0 && (
          <FeaturesCarousel
            title={t('features.landlords.title')}
            subtitle={t('features.landlords.subtitle')}
            accentColor="rose"
            features={landlordFeatures}
          />
        );
      })()}

{(() => {
        const studentFeatures = [
          {
            key: 'students.search',
            icon: <Search className="w-7 h-7" />,
            title: t('features.students.search.title'),
            description: t('features.students.search.desc'),
            imageUrl: getFeatureImage('students.search', 'https://images.pexels.com/photos/5582868/pexels-photo-5582868.jpeg')
          },
          {
            key: 'students.verified',
            icon: <Shield className="w-7 h-7" />,
            title: t('features.students.verified.title'),
            description: t('features.students.verified.desc'),
            imageUrl: getFeatureImage('students.verified', 'https://images.pexels.com/photos/7821513/pexels-photo-7821513.jpeg')
          },
          {
            key: 'students.favorites',
            icon: <Heart className="w-7 h-7" />,
            title: t('features.students.favorites.title'),
            description: t('features.students.favorites.desc'),
            imageUrl: getFeatureImage('students.favorites', 'https://images.pexels.com/photos/1370704/pexels-photo-1370704.jpeg')
          },
          {
            key: 'students.booking',
            icon: <Calendar className="w-7 h-7" />,
            title: t('features.students.booking.title'),
            description: t('features.students.booking.desc'),
            imageUrl: getFeatureImage('students.booking', 'https://images.pexels.com/photos/4968630/pexels-photo-4968630.jpeg')
          },
          {
            key: 'students.documents',
            icon: <FileText className="w-7 h-7" />,
            title: t('features.students.documents.title'),
            description: t('features.students.documents.desc'),
            imageUrl: getFeatureImage('students.documents', 'https://images.pexels.com/photos/8112195/pexels-photo-8112195.jpeg')
          },
          {
            key: 'students.access',
            icon: <Key className="w-7 h-7" />,
            title: t('features.students.access.title'),
            description: t('features.students.access.desc'),
            imageUrl: getFeatureImage('students.access', 'https://images.pexels.com/photos/279810/pexels-photo-279810.jpeg')
          },
          {
            key: 'students.community',
            icon: <Users className="w-7 h-7" />,
            title: t('features.students.community.title'),
            description: t('features.students.community.desc'),
            imageUrl: getFeatureImage('students.community', 'https://images.pexels.com/photos/1595385/pexels-photo-1595385.jpeg')
          },
          {
            key: 'students.free',
            icon: <Star className="w-7 h-7" />,
            title: t('features.students.free.title'),
            description: t('features.students.free.desc'),
            imageUrl: getFeatureImage('students.free', 'https://images.pexels.com/photos/259027/pexels-photo-259027.jpeg')
          }
        ].filter(feature => activeFeatureKeys.size === 0 || activeFeatureKeys.has(feature.key));

        return studentFeatures.length > 0 && (
          <FeaturesCarousel
            title={t('features.students.title')}
            subtitle={t('features.students.subtitle')}
            accentColor="blue"
            features={studentFeatures}
          />
        );
      })()}

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
              onClick={() => onNavigate(user ? 'search' : 'signup')}
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
              onClick={() => onNavigate(user ? 'addListing' : 'signup')}
              className="px-6 py-3 sm:px-8 sm:py-4 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition font-medium text-sm sm:text-base"
            >
              {user ? t('nav.addListing') : t('nav.signUp')}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 py-12 sm:py-20 mt-12 sm:mt-20">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-20 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 mb-4 sm:mb-6">
            {t('home.cta.title')}
          </h2>
          <p className="text-gray-600 text-base sm:text-lg mb-8 sm:mb-10">
            {t('home.cta.subtitle')}
          </p>
          <button
            onClick={() => onNavigate('signup')}
            className="px-8 py-4 sm:px-10 sm:py-5 bg-rose-500 text-white text-base sm:text-lg font-semibold rounded-full hover:bg-rose-600 transform active:scale-95 sm:hover:scale-105 transition-all shadow-xl"
          >
            {t('nav.signUp')}
          </button>
        </div>
      </div>
    </div>
  );
}
