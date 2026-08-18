import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Check, X, User, Clock, Euro, MessageCircle, CreditCard, CheckCircle, AlertCircle, Timer, Building, RefreshCw, Ban } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import BackButton from '../components/BackButton';

type Booking = {
  id: string;
  listing_id: string;
  student_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  total_price: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  payment_status: string | null;
  payment_deadline: string | null;
  payment_amount: number | null;
  rent_amount: number | null;
  deposit_amount: number | null;
  platform_fee: number | null;
  created_at: string;
  student: {
    first_name: string;
    last_name: string;
  };
  listing: {
    id: string;
    title: string;
    address: string;
    price_per_month: number;
    electricity_cost?: number;
    heating_cost?: number;
    water_cost?: number;
    security_deposit?: number;
    images: Array<{ image_url: string }>;
  } | null;
};

function PaymentCountdown({ deadline, language }: { deadline: string; language: string }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const end = new Date(deadline);
      const diff = end.getTime() - now.getTime();

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft(language === 'fr' ? 'Expire' : 'Expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        setTimeLeft(`${hours}h ${String(minutes).padStart(2, '0')}m`);
      } else {
        setTimeLeft(`${minutes}m`);
      }
    };

    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [deadline, language]);

  if (isExpired) {
    return (
      <span className="text-xs text-red-600 font-medium">
        {language === 'fr' ? 'Delai expire' : 'Expired'}
      </span>
    );
  }

  return (
    <span className="text-xs text-amber-600 font-medium tabular-nums">
      {timeLeft} {language === 'fr' ? 'restant' : 'remaining'}
    </span>
  );
}

export default function MyBookingRequests() {
  const { profile } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all');
  const [listingFilter, setListingFilter] = useState<string>('all');

  useEffect(() => {
    if (profile) {
      loadBookings();
      markBookingNotificationsAsRead();
    }
  }, [profile]);

  const markBookingNotificationsAsRead = async () => {
    if (!profile?.id) return;

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .in('type', ['booking_request', 'booking_confirmed', 'booking_cancelled'])
      .eq('is_read', false);
  };

  const loadBookings = async () => {
    if (!profile?.id) return;

    setLoading(true);

    const { data: listingsData, error: listingsError } = await supabase
      .from('listings')
      .select('id')
      .eq('landlord_id', profile.id);

    if (listingsError || !listingsData || listingsData.length === 0) {
      setBookings([]);
      setLoading(false);
      return;
    }

    const listingIds = listingsData.map(l => l.id);

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        student:profiles!bookings_student_id_fkey(first_name, last_name),
        listing:listings!bookings_listing_id_fkey(
          id,
          title,
          address,
          price_per_month,
          electricity_cost,
          heating_cost,
          water_cost,
          security_deposit,
          images:listing_images(image_url, display_order)
        )
      `)
      .in('listing_id', listingIds)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const validBookings = data.map((b: any) => {
        const listing = Array.isArray(b.listing) ? b.listing[0] || null : b.listing;
        return { ...b, listing };
      }).filter((b: any) => b.listing !== null);
      setBookings(validBookings as any);
    }

    setLoading(false);
  };

  const updateBookingStatus = async (bookingId: string, status: 'confirmed' | 'cancelled') => {
    const { error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', bookingId);

    if (!error && status === 'confirmed') {
      try {
        const booking = bookings.find(b => b.id === bookingId);
        if (booking && profile) {
          const { data: existingLease } = await supabase
            .from('leases')
            .select('id')
            .eq('booking_id', bookingId)
            .maybeSingle();

          if (!existingLease) {
            const totalPrice = booking.listing?.price_per_month || 0;
            const electricityCost = booking.listing?.electricity_cost || 0;
            const heatingCost = booking.listing?.heating_cost || 0;
            const waterCost = booking.listing?.water_cost || 0;
            const charges = electricityCost + heatingCost + waterCost;
            const monthlyRent = totalPrice - charges;
            const securityDeposit = booking.listing?.security_deposit || monthlyRent;

            await supabase.from('leases').insert({
              booking_id: bookingId,
              listing_id: booking.listing_id,
              landlord_id: profile.id,
              tenant_id: booking.student_id,
              start_date: booking.start_date,
              end_date: booking.end_date,
              monthly_rent: monthlyRent,
              security_deposit: securityDeposit,
              charges: charges,
              lease_type: 'furnished',
              status: 'draft',
              lease_source: profile.preferred_lease_type || 'hellofonty',
              terms_and_conditions: '',
              inventory_included: false
            });

            await supabase.from('notifications').insert({
              user_id: profile.id,
              type: 'lease_signature_request',
              title: language === 'fr' ? 'Bail automatique créé' : 'Lease auto-created',
              message: language === 'fr'
                ? `Un bail a été automatiquement créé pour la réservation de ${booking.student?.first_name} ${booking.student?.last_name}. Vérifiez et complétez-le dans "Mes Baux".`
                : `A lease has been auto-created for ${booking.student?.first_name} ${booking.student?.last_name}'s booking. Review and complete it in "My Leases".`,
              link: '/mes-baux',
            });
          }
        }
      } catch (leaseError) {
        console.error('Erreur création bail automatique:', leaseError);
      }
    }

    if (!error) {
      loadBookings();
      alert(status === 'confirmed' ? (language === 'fr' ? 'Réservation confirmée ! Un bail a été créé automatiquement.' : 'Booking confirmed! A lease has been auto-created.') : (language === 'fr' ? 'Réservation refusée' : 'Booking declined'));
    }
  };

  const handleContactHellofonty = () => {
    window.location.href = '/messages';
  };

  const handleCancelExpiredBooking = async (bookingId: string) => {
    if (!confirm(language === 'fr'
      ? 'Annuler cette reservation ? Le logement sera libere et l\'etudiant pourra refaire une demande.'
      : 'Cancel this booking? The property will be freed and the student can make a new request.'
    )) return;

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', payment_status: 'expired' })
      .eq('id', bookingId);

    if (!error) {
      loadBookings();
      alert(language === 'fr' ? 'Reservation annulee. Le logement est de nouveau disponible.' : 'Booking cancelled. Property is available again.');
    } else {
      alert(language === 'fr' ? 'Erreur lors de l\'annulation.' : 'Error cancelling booking.');
    }
  };

  const uniqueListings = useMemo(() => {
    const map = new Map<string, string>();
    bookings.forEach(b => {
      if (b.listing) {
        map.set(b.listing.id, b.listing.title);
      }
    });
    return Array.from(map.entries());
  }, [bookings]);

  const filteredBookings = bookings
    .filter(b => filter === 'all' || b.status === filter)
    .filter(b => listingFilter === 'all' || b.listing_id === listingFilter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-300';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    if (language === 'fr') {
      switch (status) {
        case 'pending': return 'En attente';
        case 'confirmed': return 'Confirmee';
        case 'cancelled': return 'Refusee';
        default: return status;
      }
    } else {
      switch (status) {
        case 'pending': return 'Pending';
        case 'confirmed': return 'Confirmed';
        case 'cancelled': return 'Declined';
        default: return status;
      }
    }
  };

  const getPaymentStatusInfo = (booking: Booking) => {
    if (booking.status !== 'confirmed') return null;

    if (booking.payment_status === 'completed') {
      return {
        label: language === 'fr' ? 'Paiement recu' : 'Payment received',
        color: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        icon: <CheckCircle className="w-4 h-4 text-emerald-600" />,
      };
    }

    if (booking.payment_status === 'expired') {
      return {
        label: language === 'fr' ? 'Paiement expire' : 'Payment expired',
        color: 'bg-red-50 border-red-200 text-red-800',
        icon: <AlertCircle className="w-4 h-4 text-red-600" />,
      };
    }

    if (booking.payment_deadline && new Date(booking.payment_deadline) <= new Date()) {
      return {
        label: language === 'fr' ? 'Delai de paiement expire' : 'Payment deadline expired',
        color: 'bg-red-50 border-red-200 text-red-800',
        icon: <AlertCircle className="w-4 h-4 text-red-600" />,
      };
    }

    if (booking.payment_status === 'pending' && booking.payment_deadline) {
      return {
        label: language === 'fr' ? 'En attente du paiement' : 'Awaiting payment',
        color: 'bg-amber-50 border-amber-200 text-amber-800',
        icon: <Timer className="w-4 h-4 text-amber-600" />,
        deadline: booking.payment_deadline,
      };
    }

    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{language === 'fr' ? 'Chargement...' : 'Loading...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-xl mx-auto px-6 lg:px-20 py-12">
        <BackButton />
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{language === 'fr' ? 'Mes demandes de reservation' : 'My booking requests'}</h1>
          <p className="text-gray-600">{language === 'fr' ? 'Gerez les demandes de location pour vos annonces' : 'Manage rental requests for your listings'}</p>
        </div>

        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-6 py-3 rounded-lg font-semibold transition ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {language === 'fr' ? 'Toutes' : 'All'} ({bookings.length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-6 py-3 rounded-lg font-semibold transition ${
                filter === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {language === 'fr' ? 'En attente' : 'Pending'} ({bookings.filter(b => b.status === 'pending').length})
            </button>
            <button
              onClick={() => setFilter('confirmed')}
              className={`px-6 py-3 rounded-lg font-semibold transition ${
                filter === 'confirmed'
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {language === 'fr' ? 'Confirmees' : 'Confirmed'} ({bookings.filter(b => b.status === 'confirmed').length})
            </button>
            <button
              onClick={() => setFilter('cancelled')}
              className={`px-6 py-3 rounded-lg font-semibold transition ${
                filter === 'cancelled'
                  ? 'bg-red-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {language === 'fr' ? 'Refusees' : 'Declined'} ({bookings.filter(b => b.status === 'cancelled').length})
            </button>
          </div>

          {uniqueListings.length > 1 && (
            <div className="flex items-center gap-3">
              <Building className="w-5 h-5 text-gray-500" />
              <select
                value={listingFilter}
                onChange={(e) => setListingFilter(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">{language === 'fr' ? 'Tous les logements' : 'All listings'}</option>
                {uniqueListings.map(([id, title]) => (
                  <option key={id} value={id}>{title}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {filteredBookings.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{language === 'fr' ? 'Aucune demande' : 'No requests'}</h2>
            <p className="text-gray-600">
              {filter === 'all'
                ? (language === 'fr' ? "Vous n'avez pas encore recu de demande de reservation" : "You haven't received any booking requests yet")
                : (language === 'fr' ? `Aucune demande ${getStatusLabel(filter).toLowerCase()}` : `No ${getStatusLabel(filter).toLowerCase()} requests`)}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => {
              const paymentInfo = getPaymentStatusInfo(booking);

              return (
                <div key={booking.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition">
                  <div className="flex items-center gap-4 px-6 py-4 bg-gradient-to-r from-slate-800 to-slate-700 text-white">
                    {booking.listing?.images && booking.listing.images.length > 0 && (
                      <img
                        src={booking.listing.images[0].image_url}
                        alt={booking.listing?.title || ''}
                        className="w-14 h-14 object-cover rounded-lg ring-2 ring-white/30 flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3
                        className="text-lg font-bold truncate cursor-pointer hover:text-blue-300 transition"
                        onClick={() => navigate(`/logement/${booking.listing_id}`)}
                      >
                        {booking.listing?.title || (language === 'fr' ? 'Logement' : 'Listing')}
                      </h3>
                      {booking.listing?.address && (
                        <p className="text-slate-300 text-sm truncate">{booking.listing.address}</p>
                      )}
                    </div>
                    <div className={`inline-block px-4 py-2 rounded-full font-semibold text-sm ${getStatusColor(booking.status)}`}>
                      {getStatusLabel(booking.status)}
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {paymentInfo && (
                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${paymentInfo.color}`}>
                              {paymentInfo.icon}
                              <span>{paymentInfo.label}</span>
                              {paymentInfo.deadline && (
                                <PaymentCountdown deadline={paymentInfo.deadline} language={language} />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <div className="flex items-center text-gray-700 mb-2">
                          <User className="w-5 h-5 mr-2 text-blue-600" />
                          <span className="font-semibold">{language === 'fr' ? 'Locataire' : 'Tenant'}</span>
                        </div>
                        <p className="text-gray-900 font-medium">
                          {booking.student.first_name} {booking.student.last_name}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center text-gray-700 mb-2">
                          <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                          <span className="font-semibold">{language === 'fr' ? 'Periode' : 'Period'}</span>
                        </div>
                        <p className="text-gray-900">
                          {language === 'fr' ? 'Du' : 'From'} {new Date(booking.start_date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB')}
                        </p>
                        <p className="text-gray-900">
                          {language === 'fr' ? 'Au' : 'To'} {new Date(booking.end_date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB')}
                        </p>
                        <p className="text-gray-600 text-sm mt-1">
                          {booking.total_days} {language === 'fr' ? 'jours' : 'days'}
                        </p>
                      </div>
                    </div>

                    {paymentInfo && booking.payment_amount && booking.status === 'confirmed' && (
                      <div className={`rounded-lg p-4 mb-4 border ${paymentInfo.color}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <CreditCard className="w-5 h-5" />
                          <span className="font-semibold text-sm">
                            {language === 'fr' ? 'Suivi du paiement initial' : 'Initial payment tracking'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          {booking.rent_amount && (
                            <div>
                              <p className="text-xs opacity-75">{language === 'fr' ? 'Loyer' : 'Rent'}</p>
                              <p className="font-semibold">{booking.rent_amount.toFixed(2)} EUR</p>
                            </div>
                          )}
                          {booking.deposit_amount != null && booking.deposit_amount > 0 && (
                            <div>
                              <p className="text-xs opacity-75">{language === 'fr' ? 'Caution' : 'Deposit'}</p>
                              <p className="font-semibold">{booking.deposit_amount.toFixed(2)} EUR</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs opacity-75">{language === 'fr' ? 'Total' : 'Total'}</p>
                            <p className="font-bold text-base">{((booking.rent_amount || 0) + (booking.deposit_amount || 0)).toFixed(2)} EUR</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between p-4 bg-gradient-to-br from-blue-50 to-sky-50 rounded-lg mb-4">
                      <div className="flex items-center">
                        <Euro className="w-6 h-6 text-blue-600 mr-2" />
                        <span className="text-gray-700 font-semibold">{language === 'fr' ? 'Montant total' : 'Total amount'}</span>
                      </div>
                      <span className="text-3xl font-bold text-blue-600">
                        {(((booking.rent_amount || 0) + (booking.deposit_amount || 0)) || booking.total_price).toFixed(2)}€
                      </span>
                    </div>

                    <div className="flex items-center text-gray-500 text-sm mb-4">
                      <Clock className="w-4 h-4 mr-2" />
                      {language === 'fr' ? 'Demande recue le' : 'Request received on'} {new Date(booking.created_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB')} {language === 'fr' ? 'a' : 'at'} {new Date(booking.created_at).toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>

                    {booking.status === 'pending' && (
                      <div className="flex space-x-3">
                        <button
                          onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                          className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
                        >
                          <Check className="w-5 h-5" />
                          <span>{t('booking.accept')}</span>
                        </button>
                        <button
                          onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                          className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition"
                        >
                          <X className="w-5 h-5" />
                          <span>{t('booking.decline')}</span>
                        </button>
                      </div>
                    )}

                    {booking.status === 'confirmed' && (
                      <div className="flex space-x-3">
                        <button
                          onClick={() => navigate('/messages')}
                          className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                        >
                          <MessageCircle className="w-5 h-5" />
                          <span>{t('booking.contactTenant')}</span>
                        </button>
                        {booking.payment_status === 'completed' && (
                          <button
                            onClick={() => navigate('/proprietaire/loyers')}
                            className="flex items-center justify-center space-x-2 px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition"
                          >
                            <Euro className="w-5 h-5" />
                            <span>{language === 'fr' ? 'Voir les loyers' : 'View rents'}</span>
                          </button>
                        )}

                        {booking.status === 'confirmed' && booking.payment_status !== 'completed' && booking.payment_deadline && new Date(booking.payment_deadline) <= new Date() && (
                          <div className="flex flex-col sm:flex-row gap-3 w-full">
                            <button
                              onClick={() => handleExtendDeadline(booking.id)}
                              className="flex items-center justify-center space-x-2 px-5 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition flex-1"
                            >
                              <RefreshCw className="w-5 h-5" />
                              <span>{language === 'fr' ? 'Relancer le paiement (72h)' : 'Extend payment (72h)'}</span>
                            </button>
                            <button
                              onClick={() => handleCancelExpiredBooking(booking.id)}
                              className="flex items-center justify-center space-x-2 px-5 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition flex-1"
                            >
                              <Ban className="w-5 h-5" />
                              <span>{language === 'fr' ? 'Annuler la reservation' : 'Cancel booking'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
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
