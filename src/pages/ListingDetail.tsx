import { useState, useEffect } from 'react';
import { MapPin, BedDouble, Bath, Users, Heart, MessageCircle, Calendar, ChevronLeft, ChevronRight, Wifi, Home, Tv, Wind, Flame, TreePine, Flower2, ParkingCircle, WashingMachine, Monitor, Sparkles, Zap, Bike, Gamepad2, Dumbbell, Waves, Building, Euro, Receipt, Info, ArrowLeft, Star, Shield, Sheet, Fan } from 'lucide-react';
import { supabase, Listing } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import BookingCalendar from '../components/BookingCalendar';
import ListingMap from '../components/ListingMap';

type ListingDetailProps = {
  listingId: string;
  onNavigate: (page: string, id?: string) => void;
};

export default function ListingDetail({ listingId, onNavigate }: ListingDetailProps) {
  const { t, translateFeature } = useLanguage();
  const { user, profile } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showContactForm, setShowContactForm] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [existingBookings, setExistingBookings] = useState<Array<{ start_date: string; end_date: string }>>([]);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [bookingData, setBookingData] = useState<{ startDate: Date | null; endDate: Date | null; totalPrice: number } | null>(null);
  const [landlordStats, setLandlordStats] = useState<{ totalListings: number; memberSince: string } | null>(null);

  useEffect(() => {
    loadListing();
    loadBookings();
    loadBlockedDates();
    if (profile?.role === 'student') {
      checkFavorite();
    }
  }, [listingId, profile]);

  const loadListing = async () => {
    const { data, error } = await supabase
      .from('listings')
      .select(`
        *,
        landlord:profiles!landlord_id(*),
        images:listing_images(*)
      `)
      .eq('id', listingId)
      .maybeSingle();

    if (!error && data) {
      setListing(data);

      if (data.landlord_id) {
        const { data: listingsCount } = await supabase
          .from('listings')
          .select('id', { count: 'exact' })
          .eq('landlord_id', data.landlord_id);

        const { data: profileData } = await supabase
          .from('profiles')
          .select('created_at')
          .eq('id', data.landlord_id)
          .maybeSingle();

        if (profileData) {
          setLandlordStats({
            totalListings: listingsCount?.length || 0,
            memberSince: profileData.created_at,
          });
        }
      }
    }
    setLoading(false);
  };

  const loadBookings = async () => {
    const { data } = await supabase
      .from('bookings')
      .select('start_date, end_date')
      .eq('listing_id', listingId)
      .eq('status', 'confirmed');

    if (data) {
      setExistingBookings(data);
    }
  };

  const loadBlockedDates = async () => {
    const { data } = await supabase
      .from('blocked_dates')
      .select('blocked_date')
      .eq('listing_id', listingId);

    if (data) {
      setBlockedDates(data.map(d => d.blocked_date));
    }
  };

  const checkFavorite = async () => {
    const { data } = await supabase
      .from('favorites')
      .select('id')
      .eq('student_id', profile?.id || '')
      .eq('listing_id', listingId)
      .maybeSingle();

    setIsFavorite(!!data);
  };

  const toggleFavorite = async () => {
    if (profile?.role !== 'student') return;

    if (isFavorite) {
      await supabase
        .from('favorites')
        .delete()
        .eq('student_id', profile.id)
        .eq('listing_id', listingId);
      setIsFavorite(false);
    } else {
      await supabase.from('favorites').insert({
        student_id: profile.id,
        listing_id: listingId,
      });
      setIsFavorite(true);
    }
  };

  const handleContactClick = () => {
    if (!user) {
      onNavigate('signin');
      return;
    }
    setShowContactForm(!showContactForm);
  };

  const handleBookingSelect = (startDate: Date, endDate: Date, totalPrice: number) => {
    setBookingData({ startDate, endDate, totalPrice });
  };

  const confirmBooking = async () => {
    if (!bookingData || !listing) return;

    if (!user || !profile) {
      onNavigate('signin');
      return;
    }

    // Vérifier que le compte est validé
    if (profile.role === 'student' && profile.verification_status !== 'approved') {
      alert(
        profile.preferred_language === 'fr'
          ? '⚠️ Vous devez valider votre compte avant de pouvoir réserver. Rendez-vous sur votre profil pour soumettre vos documents.'
          : '⚠️ You must validate your account before booking. Go to your profile to submit your documents.'
      );
      onNavigate('profile');
      return;
    }

    const days = Math.ceil((bookingData.endDate!.getTime() - bookingData.startDate!.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const { data: bookingResult, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        listing_id: listingId,
        student_id: profile.id,
        start_date: bookingData.startDate!.toISOString().split('T')[0],
        end_date: bookingData.endDate!.toISOString().split('T')[0],
        total_days: days,
        total_price: bookingData.totalPrice,
        status: 'pending',
      })
      .select()
      .single();

    if (!bookingError && bookingResult) {
      const messageContent = `📅 Nouvelle demande de réservation

Période: ${new Date(bookingData.startDate!).toLocaleDateString('fr-FR')} - ${new Date(bookingData.endDate!).toLocaleDateString('fr-FR')}
Durée: ${days} jour${days > 1 ? 's' : ''}
Prix total: ${bookingData.totalPrice.toFixed(0)}€

En attente de votre confirmation.`;

      await supabase.from('messages').insert({
        sender_id: profile.id,
        recipient_id: listing.landlord_id,
        listing_id: listingId,
        booking_id: bookingResult.id,
        content: messageContent,
      });

      await supabase.from('notifications').insert({
        user_id: listing.landlord_id,
        type: 'booking_request',
        title: 'Nouvelle demande de réservation',
        message: `${profile.first_name} ${profile.last_name} a fait une demande de réservation pour ${listing.title}`,
        link: `/bookings/${bookingResult.id}`,
      });

      alert('Demande de réservation envoyée avec succès!');
      setBookingData(null);
      loadBookings();
    } else {
      alert('Erreur lors de la réservation');
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !listing || !profile) return;

    setSending(true);
    await supabase.from('messages').insert({
      sender_id: profile.id,
      recipient_id: listing.landlord_id,
      listing_id: listingId,
      content: message,
    });

    setMessage('');
    setShowContactForm(false);
    setSending(false);
    alert(t('common.success'));
  };

  const nextImage = () => {
    if (listing?.images && listing.images.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % listing.images.length);
    }
  };

  const prevImage = () => {
    if (listing?.images && listing.images.length > 0) {
      setCurrentImageIndex((prev) =>
        prev === 0 ? listing.images.length - 1 : prev - 1
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-xl text-gray-600">{t('search.noResults')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center space-x-2 mb-6 px-4 py-2 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition shadow-sm"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Retour</span>
        </button>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="relative h-96 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl overflow-hidden">
            {listing.images && listing.images.length > 0 ? (
              <>
                <img
                  src={listing.images[currentImageIndex].image_url}
                  alt={listing.title}
                  className="w-full h-full object-cover rounded-2xl"
                />
                {listing.images.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full hover:bg-white transition"
                    >
                      <ChevronLeft className="h-6 w-6 text-gray-800" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full hover:bg-white transition"
                    >
                      <ChevronRight className="h-6 w-6 text-gray-800" />
                    </button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
                      {listing.images.map((_, idx) => (
                        <div
                          key={idx}
                          className={`h-2 w-2 rounded-full ${
                            idx === currentImageIndex ? 'bg-white' : 'bg-white/50'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <MapPin className="h-24 w-24 text-white opacity-50" />
              </div>
            )}
          </div>

          <div className="p-8">
            <div className="mb-6">
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-2">{listing.title}</h1>
              <div className="flex items-center text-gray-600">
                <MapPin className="h-5 w-5 mr-2" />
                <span className="text-lg">
                  {listing.address}, {listing.city} {listing.postal_code}
                </span>
              </div>
            </div>

{listing.video_url && (() => {
              const getEmbedUrl = (url: string) => {
                try {
                  // YouTube formats
                  const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
                  const youtubeMatch = url.match(youtubeRegex);
                  if (youtubeMatch) {
                    const videoId = youtubeMatch[1];
                    return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
                  }

                  // Vimeo formats
                  const vimeoRegex = /(?:vimeo\.com\/)(\d+)/;
                  const vimeoMatch = url.match(vimeoRegex);
                  if (vimeoMatch) {
                    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
                  }

                  // Dailymotion formats
                  const dailymotionRegex = /(?:dailymotion\.com\/video\/)([^_\s]+)/;
                  const dailymotionMatch = url.match(dailymotionRegex);
                  if (dailymotionMatch) {
                    return `https://www.dailymotion.com/embed/video/${dailymotionMatch[1]}`;
                  }

                  // Si déjà un URL embed, le retourner tel quel
                  if (url.includes('embed') || url.includes('player')) {
                    return url;
                  }

                  return url;
                } catch (error) {
                  console.error('Erreur lors de la conversion de l\'URL vidéo:', error);
                  return url;
                }
              };

              const embedUrl = getEmbedUrl(listing.video_url);

              return (
                <div className="mb-8 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <span className="w-8 h-8 bg-rose-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-rose-600" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                        </svg>
                      </span>
                      Visite Vidéo
                    </h3>
                  </div>
                  <div className="relative w-full bg-black" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                      src={embedUrl}
                      title="Vidéo de présentation"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                      className="absolute top-0 left-0 w-full h-full"
                    />
                  </div>
                </div>
              );
            })()}

            {listing.security_deposit && listing.security_deposit > 0 && (
              <div className="mb-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-300 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">
                      {language === 'fr' ? 'Dépôt de garantie' : 'Security deposit'}
                    </h3>
                    <p className="text-xs text-gray-600">
                      {language === 'fr'
                        ? 'Remboursable en fin de location'
                        : 'Refundable at end of lease'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-purple-700">
                      {listing.security_deposit.toFixed(0)} €
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-purple-100 rounded-lg p-3">
                  <Info className="w-4 h-4 text-purple-700 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-purple-900 leading-relaxed">
                    {language === 'fr'
                      ? 'Ce montant vous sera restitué à la fin de votre bail, après vérification de l\'état du logement.'
                      : 'This amount will be returned to you at the end of your lease, after verification of the property condition.'}
                  </p>
                </div>
              </div>
            )}

            <div className="mb-8">
              <BookingCalendar
                pricePerMonth={listing.price_per_month}
                charges={listing.charges || 0}
                minimumStayMonths={listing.minimum_stay || 1}
                existingBookings={existingBookings}
                blockedDates={blockedDates}
                onBookingSelect={handleBookingSelect}
              />
              {bookingData && (
                <div className="mt-4">
                  <button
                    onClick={confirmBooking}
                    className="w-full px-6 py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition shadow-lg"
                  >
                    {user ? t('listing.bookingRequest') : t('listing.signInToBook')}
                  </button>
                </div>
              )}
            </div>


            <div className="grid grid-cols-3 gap-3 sm:gap-4 md:flex md:items-center md:space-x-6 mb-8 pb-8 border-b">
              <div className="flex flex-col sm:flex-row items-center sm:space-x-2 text-center sm:text-left">
                <BedDouble className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600 mb-1 sm:mb-0" />
                <span className="text-sm sm:text-base md:text-lg">
                  {listing.bedrooms} {t('listing.bedrooms')}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-center sm:space-x-2 text-center sm:text-left">
                <Bath className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600 mb-1 sm:mb-0" />
                <span className="text-sm sm:text-base md:text-lg">
                  {listing.bathrooms} {t('listing.bathrooms')}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-center sm:space-x-2 text-center sm:text-left">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600 mb-1 sm:mb-0" />
                <span className="text-sm sm:text-base md:text-lg">
                  {listing.max_guests} {t('listing.guests')}
                </span>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('listing.details')}</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {listing.description}
              </p>
            </div>

            {listing.amenities && listing.amenities.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  {t('listing.amenities')}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {listing.amenities.map((amenity, idx) => {
                    const getAmenityIcon = (amenityName: string) => {
                      const name = amenityName.toLowerCase();
                      if (name.includes('wifi')) return <Wifi className="h-5 w-5" />;
                      if (name.includes('cuisine') || name.includes('kitchen')) return <Home className="h-5 w-5" />;
                      if (name.includes('tv')) return <Tv className="h-5 w-5" />;
                      if (name.includes('climatisation') || name.includes('air conditioning')) return <Wind className="h-5 w-5" />;
                      if (name.includes('chauffage') || name.includes('heating')) return <Flame className="h-5 w-5" />;
                      if (name.includes('jardin') || name.includes('garden')) return <TreePine className="h-5 w-5" />;
                      if (name.includes('balcon') || name.includes('balcony')) return <Flower2 className="h-5 w-5" />;
                      if (name.includes('parking')) return <ParkingCircle className="h-5 w-5" />;
                      if (name.includes('lave-linge') || name.includes('washing')) return <WashingMachine className="h-5 w-5" />;
                      if (name.includes('bureau') || name.includes('desk')) return <Monitor className="h-5 w-5" />;
                      if (name.includes('linge') || name.includes('linen') || name.includes('serviettes') || name.includes('draps') || name.includes('towel') || name.includes('sheet')) return <Sheet className="h-5 w-5" />;
                      if (name.includes('ventilateur') || name.includes('fan')) return <Fan className="h-5 w-5" />;
                      return <Home className="h-5 w-5" />;
                    };

                    return (
                      <div
                        key={idx}
                        className="flex items-center space-x-3 text-gray-700 bg-gray-50 px-4 py-3 rounded-lg border border-gray-200"
                      >
                        <div className="text-rose-500">
                          {getAmenityIcon(amenity)}
                        </div>
                        <span className="font-medium">{amenity}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {listing.bonus_features && listing.bonus_features.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center mb-4">
                  <Sparkles className="w-6 h-6 text-amber-500 mr-2" />
                  <h2 className="text-2xl font-bold text-gray-900">
                    {t('listing.amenities')} Premium
                  </h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {listing.bonus_features.map((bonus, idx) => {
                    const getBonusIcon = (bonusName: string) => {
                      const name = bonusName.toLowerCase();
                      if (name.includes('fibre') || name.includes('fiber')) return <Zap className="h-5 w-5" />;
                      if (name.includes('netflix') || name.includes('disney') || name.includes('prime')) return <Tv className="h-5 w-5" />;
                      if (name.includes('vélo') || name.includes('bicycle')) return <Bike className="h-5 w-5" />;
                      if (name.includes('trottinette') || name.includes('scooter')) return <Bike className="h-5 w-5" />;
                      if (name.includes('console') || name.includes('game')) return <Gamepad2 className="h-5 w-5" />;
                      if (name.includes('sport') || name.includes('gym')) return <Dumbbell className="h-5 w-5" />;
                      if (name.includes('piscine') || name.includes('pool')) return <Waves className="h-5 w-5" />;
                      if (name.includes('terrasse') || name.includes('terrace')) return <Flower2 className="h-5 w-5" />;
                      if (name.includes('cave') || name.includes('storage')) return <Building className="h-5 w-5" />;
                      if (name.includes('parking')) return <ParkingCircle className="h-5 w-5" />;
                      return <Sparkles className="h-5 w-5" />;
                    };

                    return (
                      <div
                        key={idx}
                        className="flex items-center space-x-3 text-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 px-4 py-3 rounded-lg border-2 border-amber-300"
                      >
                        <div className="text-amber-600">
                          {getBonusIcon(bonus)}
                        </div>
                        <span className="font-semibold">{translateFeature(bonus)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* House Rules Section */}
            <div className="mb-8">
              <div className="flex items-center mb-4">
                <Shield className="w-6 h-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-bold text-gray-900">
                  {t('listing.houseRules') || (profile?.preferred_language === 'fr' ? 'Règles de la maison' : 'House rules')}
                </h2>
              </div>

              <div className="space-y-4">
                {/* Check-in / Check-out */}
                <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200">
                  <h3 className="font-bold text-gray-900 mb-3">
                    {profile?.preferred_language === 'fr' ? 'Horaires' : 'Schedule'}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">{profile?.preferred_language === 'fr' ? 'Check-in' : 'Check-in'}:</span>
                      <span className="font-semibold text-gray-900">
                        {listing.check_in_start || '14:00'} - {listing.check_in_end || '22:00'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">{profile?.preferred_language === 'fr' ? 'Check-out' : 'Check-out'}:</span>
                      <span className="font-semibold text-gray-900">{listing.check_out_time || '11:00'}</span>
                    </div>
                  </div>
                </div>

                {/* Autorisations */}
                <div className="bg-green-50 rounded-xl p-4 border-2 border-green-200">
                  <h3 className="font-bold text-gray-900 mb-3">
                    {profile?.preferred_language === 'fr' ? 'Autorisations' : 'Permissions'}
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${listing.pets_allowed ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      <span className={listing.pets_allowed ? 'text-green-700 font-semibold' : 'text-gray-600'}>
                        {profile?.preferred_language === 'fr' ? 'Animaux' : 'Pets'} {listing.pets_allowed ? '✓' : '✗'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${listing.smoking_allowed ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      <span className={listing.smoking_allowed ? 'text-green-700 font-semibold' : 'text-gray-600'}>
                        {profile?.preferred_language === 'fr' ? 'Fumeur' : 'Smoking'} {listing.smoking_allowed ? '✓' : '✗'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${listing.parties_allowed ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      <span className={listing.parties_allowed ? 'text-green-700 font-semibold' : 'text-gray-600'}>
                        {profile?.preferred_language === 'fr' ? 'Fêtes' : 'Parties'} {listing.parties_allowed ? '✓' : '✗'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${listing.children_allowed ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      <span className={listing.children_allowed ? 'text-green-700 font-semibold' : 'text-gray-600'}>
                        {profile?.preferred_language === 'fr' ? 'Enfants' : 'Children'} {listing.children_allowed ? '✓' : '✗'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Heures de calme */}
                <div className="bg-purple-50 rounded-xl p-4 border-2 border-purple-200">
                  <h3 className="font-bold text-gray-900 mb-2">
                    {profile?.preferred_language === 'fr' ? 'Heures de calme' : 'Quiet hours'}
                  </h3>
                  <p className="text-sm text-gray-700">
                    {listing.quiet_hours_start || '22:00'} - {listing.quiet_hours_end || '08:00'}
                  </p>
                </div>

                {/* Séjour minimum */}
                <div className="bg-rose-50 rounded-xl p-4 border-2 border-rose-200">
                  <h3 className="font-bold text-gray-900 mb-2">
                    {profile?.preferred_language === 'fr' ? 'Séjour minimum' : 'Minimum stay'}
                  </h3>
                  <p className="text-sm text-gray-700">
                    <span className="text-lg font-bold text-rose-700">{listing.minimum_stay || 1}</span>{' '}
                    {profile?.preferred_language === 'fr'
                      ? (listing.minimum_stay && listing.minimum_stay > 1 ? 'mois' : 'mois')
                      : (listing.minimum_stay && listing.minimum_stay > 1 ? 'months' : 'month')}
                  </p>
                </div>

                {/* Règles supplémentaires */}
                {listing.additional_rules && (
                  <div className="bg-amber-50 rounded-xl p-4 border-2 border-amber-200">
                    <h3 className="font-bold text-gray-900 mb-2">
                      {profile?.preferred_language === 'fr' ? 'Règles supplémentaires' : 'Additional rules'}
                    </h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{listing.additional_rules}</p>
                  </div>
                )}
              </div>
            </div>

            {listing.latitude && listing.longitude && (
              <ListingMap
                latitude={parseFloat(listing.latitude.toString())}
                longitude={parseFloat(listing.longitude.toString())}
                title={listing.title}
                address={`${listing.address}, ${listing.city} ${listing.postal_code}`}
              />
            )}

            {listing.landlord && (
              <div className="mb-6 md:mb-8 p-4 md:p-6 bg-white border border-gray-200 rounded-xl md:rounded-2xl shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    {listing.landlord.avatar_url ? (
                      <img
                        src={listing.landlord.avatar_url}
                        alt={listing.landlord.first_name}
                        className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center text-white text-lg md:text-xl font-semibold">
                        {listing.landlord.first_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5">
                      <Shield className="w-3 h-3 text-rose-500" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm md:text-base font-semibold text-gray-900">
                          {listing.landlord.first_name}
                        </p>
                        {landlordStats && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {landlordStats.totalListings} {landlordStats.totalListings > 1 ? (t('listing.listings') || 'annonces') : (t('listing.listing') || 'annonce')} · {t('listing.memberSince')} {new Date(landlordStats.memberSince).getFullYear()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex space-x-4">
              {profile?.role === 'student' && (
                <button
                  onClick={toggleFavorite}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-semibold transition ${
                    isFavorite
                      ? 'bg-red-50 text-red-600 hover:bg-red-100'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Heart
                    className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`}
                  />
                  <span>
                    {isFavorite
                      ? t('listing.removeFromFavorites')
                      : t('listing.addToFavorites')}
                  </span>
                </button>
              )}

              <button
                onClick={handleContactClick}
                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                <MessageCircle className="h-5 w-5" />
                <span>{user ? t('listing.contact') : 'Se connecter pour contacter'}</span>
              </button>
            </div>

            {showContactForm && user && (
              <div className="mt-6 p-6 bg-gray-50 rounded-xl">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  {t('listing.contact')}
                </h3>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('messages.typeMessage')}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                />
                <div className="flex space-x-4">
                  <button
                    onClick={sendMessage}
                    disabled={sending || !message.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {sending ? t('common.loading') : t('messages.send')}
                  </button>
                  <button
                    onClick={() => setShowContactForm(false)}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
