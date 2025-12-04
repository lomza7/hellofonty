import { Shield, Heart, MessageCircle, Lock, Home as HomeIcon, Calendar, FileText, Key, CheckCircle, Search, Star, Users, CreditCard, BarChart3, FileSignature, Banknote, ClipboardCheck } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import FeaturedListings from '../components/FeaturedListings';
import PlatformStats from '../components/PlatformStats';
import SearchBar, { SearchFilters } from '../components/SearchBar';
import FeaturesCarousel from '../components/FeaturesCarousel';
import LazyLoad from '../components/LazyLoad';

type HomeProps = {
  onNavigate: (page: string, listingId?: string) => void;
};

export default function Home({ onNavigate }: HomeProps) {
  const { t } = useLanguage();
  const { user } = useAuth();

  const handleSearch = (filters: SearchFilters) => {
    console.log('Search filters:', filters);
    onNavigate('search');
  };

  return (
    <div className="min-h-screen">
      <div
        className="relative min-h-[700px] sm:min-h-[650px] bg-cover bg-center"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url(/c247c1e3d0262d28f2b23c1fb19e4a31.png)',
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center py-8 sm:py-16">
          <div className="w-full px-4 sm:px-6 max-w-5xl">
            <div className="flex justify-center mb-4 sm:mb-6">
              <div className="inline-flex items-center gap-2 px-3 sm:px-6 py-1.5 sm:py-3 bg-white/10 backdrop-blur-md border-2 border-white/30 rounded-full hover:bg-white/20 hover:border-white/40 transition-all duration-300 cursor-pointer group">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-white font-semibold text-xs sm:text-sm tracking-wide uppercase group-hover:tracking-wider transition-all">
                  For INSEAD Only
                </span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-4xl md:text-6xl font-bold text-white mb-2 sm:mb-4 tracking-tight text-center leading-tight px-2">
              {t('home.hero.title')}
            </h1>
            <p className="text-xs sm:text-lg md:text-xl text-white mb-6 sm:mb-8 font-light text-center px-6">
              {t('home.hero.subtitle')}
            </p>

            <div className="max-w-4xl mx-auto">
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

      <LazyLoad>
        <FeaturesCarousel
          title={t('features.landlords.title')}
          subtitle={t('features.landlords.subtitle')}
          accentColor="rose"
          features={[
            {
              icon: <FileSignature className="w-7 h-7" />,
              title: t('features.landlords.lease.title'),
              description: t('features.landlords.lease.desc'),
              imageUrl: 'https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg'
            },
            {
              icon: <Banknote className="w-7 h-7" />,
              title: t('features.landlords.payment.title'),
              description: t('features.landlords.payment.desc'),
              imageUrl: 'https://images.pexels.com/photos/4968630/pexels-photo-4968630.jpeg'
            },
            {
              icon: <ClipboardCheck className="w-7 h-7" />,
              title: t('features.landlords.inventory.title'),
              description: t('features.landlords.inventory.desc'),
              imageUrl: 'https://images.pexels.com/photos/7078666/pexels-photo-7078666.jpeg'
            },
            {
              icon: <HomeIcon className="w-7 h-7" />,
              title: t('features.landlords.listings.title'),
              description: t('features.landlords.listings.desc'),
              imageUrl: 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg'
            },
            {
              icon: <Calendar className="w-7 h-7" />,
              title: t('features.landlords.bookings.title'),
              description: t('features.landlords.bookings.desc'),
              imageUrl: 'https://images.pexels.com/photos/5717546/pexels-photo-5717546.jpeg'
            },
            {
              icon: <Key className="w-7 h-7" />,
              title: t('features.landlords.access.title'),
              description: t('features.landlords.access.desc'),
              imageUrl: 'https://images.pexels.com/photos/5705471/pexels-photo-5705471.jpeg'
            },
            {
              icon: <CheckCircle className="w-7 h-7" />,
              title: t('features.landlords.verification.title'),
              description: t('features.landlords.verification.desc'),
              imageUrl: 'https://images.pexels.com/photos/5668838/pexels-photo-5668838.jpeg'
            },
            {
              icon: <MessageCircle className="w-7 h-7" />,
              title: t('features.landlords.messaging.title'),
              description: t('features.landlords.messaging.desc'),
              imageUrl: 'https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg'
            },
            {
              icon: <BarChart3 className="w-7 h-7" />,
              title: t('features.landlords.stats.title'),
              description: t('features.landlords.stats.desc'),
              imageUrl: 'https://images.pexels.com/photos/7947664/pexels-photo-7947664.jpeg'
            }
          ]}
        />
      </LazyLoad>

      <LazyLoad>
        <FeaturesCarousel
          title={t('features.students.title')}
          subtitle={t('features.students.subtitle')}
          accentColor="blue"
          features={[
            {
              icon: <Search className="w-7 h-7" />,
              title: t('features.students.search.title'),
              description: t('features.students.search.desc'),
              imageUrl: 'https://images.pexels.com/photos/5582868/pexels-photo-5582868.jpeg'
            },
            {
              icon: <Shield className="w-7 h-7" />,
              title: t('features.students.verified.title'),
              description: t('features.students.verified.desc'),
              imageUrl: 'https://images.pexels.com/photos/7821513/pexels-photo-7821513.jpeg'
            },
            {
              icon: <Heart className="w-7 h-7" />,
              title: t('features.students.favorites.title'),
              description: t('features.students.favorites.desc'),
              imageUrl: 'https://images.pexels.com/photos/1370704/pexels-photo-1370704.jpeg'
            },
            {
              icon: <Calendar className="w-7 h-7" />,
              title: t('features.students.booking.title'),
              description: t('features.students.booking.desc'),
              imageUrl: 'https://images.pexels.com/photos/4968630/pexels-photo-4968630.jpeg'
            },
            {
              icon: <FileText className="w-7 h-7" />,
              title: t('features.students.documents.title'),
              description: t('features.students.documents.desc'),
              imageUrl: 'https://images.pexels.com/photos/8112195/pexels-photo-8112195.jpeg'
            },
            {
              icon: <Key className="w-7 h-7" />,
              title: t('features.students.access.title'),
              description: t('features.students.access.desc'),
              imageUrl: 'https://images.pexels.com/photos/279810/pexels-photo-279810.jpeg'
            },
            {
              icon: <Users className="w-7 h-7" />,
              title: t('features.students.community.title'),
              description: t('features.students.community.desc'),
              imageUrl: 'https://images.pexels.com/photos/1595385/pexels-photo-1595385.jpeg'
            },
            {
              icon: <Star className="w-7 h-7" />,
              title: t('features.students.free.title'),
              description: t('features.students.free.desc'),
              imageUrl: 'https://images.pexels.com/photos/259027/pexels-photo-259027.jpeg'
            }
          ]}
        />
      </LazyLoad>

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
          <div
            className="h-64 sm:h-96 bg-cover bg-center rounded-2xl sm:rounded-3xl shadow-2xl"
            style={{
              backgroundImage:
                'url(/Etat_lieux_AdobeStock_897x505.jpg)',
            }}
          />
        </div>

        <div className="mt-12 sm:mt-20 grid md:grid-cols-2 gap-8 sm:gap-16 items-center">
          <div
            className="h-64 sm:h-96 bg-cover bg-center rounded-2xl sm:rounded-3xl shadow-2xl order-2 md:order-1"
            style={{
              backgroundImage:
                'url("/beymedias.brightspotcdn copy.jpg")',
            }}
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
