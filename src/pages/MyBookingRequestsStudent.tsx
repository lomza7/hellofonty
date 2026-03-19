import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Clock, CheckCircle, XCircle, AlertCircle, Trash2, CreditCard, Timer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import BackButton from '../components/BackButton';

type Booking = {
  id: string;
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
  listing: {
    id: string;
    title: string;
    address: string;
    city: string;
    price_per_month: number;
    landlord_id: string;
    images: Array<{ image_url: string }>;
  };
};

function CountdownTimer({ deadline, language }: { deadline: string; language: string }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [urgency, setUrgency] = useState<'normal' | 'warning' | 'critical'>('normal');

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
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours < 2) {
        setUrgency('critical');
      } else if (hours < 6) {
        setUrgency('warning');
      } else {
        setUrgency('normal');
      }

      if (hours > 0) {
        setTimeLeft(`${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`);
      } else {
        setTimeLeft(`${minutes}m ${String(seconds).padStart(2, '0')}s`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline, language]);

  if (isExpired) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-800 rounded-full text-sm font-medium">
        <XCircle className="w-4 h-4" />
        <span>{language === 'fr' ? 'Delai expire' : 'Deadline expired'}</span>
      </div>
    );
  }

  const colors = {
    normal: 'bg-blue-50 text-blue-800 border-blue-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    critical: 'bg-red-50 text-red-800 border-red-200',
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${colors[urgency]}`}>
      <Timer className={`w-4 h-4 ${urgency === 'critical' ? 'animate-pulse' : ''}`} />
      <div>
        <p className="text-xs font-medium opacity-75">
          {language === 'fr' ? 'Temps restant pour payer' : 'Time left to pay'}
        </p>
        <p className="font-bold text-sm tabular-nums">{timeLeft}</p>
      </div>
    </div>
  );
}

export default function MyBookingRequestsStudent() {
  const { profile } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

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

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id,
        start_date,
        end_date,
        total_days,
        total_price,
        status,
        payment_status,
        payment_deadline,
        payment_amount,
        rent_amount,
        deposit_amount,
        platform_fee,
        created_at,
        listing:listings!listing_id(
          id,
          title,
          address,
          city,
          price_per_month,
          landlord_id,
          images:listing_images(image_url)
        )
      `)
      .eq('student_id', profile.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setBookings(data as any);
    }
    setLoading(false);
  };

  const cancelBooking = async (booking: Booking) => {
    if (!confirm(language === 'fr' ? 'Voulez-vous vraiment annuler cette demande de reservation ?' : 'Are you sure you want to cancel this booking request?')) {
      return;
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', booking.id);

    if (updateError) {
      alert(language === 'fr' ? "Erreur lors de l'annulation de la demande" : 'Error cancelling the request');
      return;
    }

    const messageContent = `❌ Demande de reservation annulee

L'etudiant a annule sa demande de reservation.

Periode: ${new Date(booking.start_date).toLocaleDateString('fr-FR')} - ${new Date(booking.end_date).toLocaleDateString('fr-FR')}
Duree: ${booking.total_days} jour${booking.total_days > 1 ? 's' : ''}
Prix total: ${booking.total_price.toFixed(0)}€`;

    await supabase.from('messages').insert({
      sender_id: profile!.id,
      recipient_id: booking.listing.landlord_id,
      listing_id: booking.listing.id,
      booking_id: booking.id,
      content: messageContent,
    });

    await supabase.from('notifications').insert({
      user_id: booking.listing.landlord_id,
      type: 'booking_cancelled',
      title: 'Demande annulee',
      message: `${profile!.first_name} ${profile!.last_name} a annule sa demande de reservation pour ${booking.listing.title}`,
      link: `/bookings/${booking.id}`,
    });

    loadBookings();
    alert(language === 'fr' ? 'Demande annulee avec succes!' : 'Request cancelled successfully!');
  };

  const needsPayment = (booking: Booking) => {
    return (
      booking.status === 'confirmed' &&
      booking.payment_status === 'pending' &&
      booking.payment_deadline &&
      new Date(booking.payment_deadline) > new Date()
    );
  };

  const isPaymentExpired = (booking: Booking) => {
    return (
      booking.status === 'confirmed' &&
      booking.payment_status === 'pending' &&
      booking.payment_deadline &&
      new Date(booking.payment_deadline) <= new Date()
    );
  };

  const isPaymentCompleted = (booking: Booking) => {
    return booking.payment_status === 'completed';
  };

  const getStatusBadge = (booking: Booking) => {
    if (isPaymentCompleted(booking)) {
      return (
        <div className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-full">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm font-medium">{language === 'fr' ? 'Payee' : 'Paid'}</span>
        </div>
      );
    }

    if (needsPayment(booking)) {
      return (
        <div className="flex items-center space-x-2 px-3 py-1.5 bg-orange-100 text-orange-800 rounded-full">
          <CreditCard className="w-4 h-4" />
          <span className="text-sm font-medium">{language === 'fr' ? 'A payer' : 'Payment required'}</span>
        </div>
      );
    }

    if (isPaymentExpired(booking)) {
      return (
        <div className="flex items-center space-x-2 px-3 py-1.5 bg-red-100 text-red-800 rounded-full">
          <XCircle className="w-4 h-4" />
          <span className="text-sm font-medium">{language === 'fr' ? 'Delai expire' : 'Expired'}</span>
        </div>
      );
    }

    switch (booking.status) {
      case 'pending':
        return (
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{language === 'fr' ? 'En attente' : 'Pending'}</span>
          </div>
        );
      case 'confirmed':
        return (
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-green-100 text-green-800 rounded-full">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{language === 'fr' ? 'Confirmee' : 'Confirmed'}</span>
          </div>
        );
      case 'cancelled':
        return (
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-red-100 text-red-800 rounded-full">
            <XCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{language === 'fr' ? 'Annulee' : 'Cancelled'}</span>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <BackButton />
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{language === 'fr' ? 'Mes demandes de reservation' : 'My booking requests'}</h1>
          <p className="text-lg text-gray-600">
            {language === 'fr' ? "Suivez l'etat de toutes vos demandes de reservation" : 'Track the status of all your booking requests'}
          </p>
        </div>

        {bookings.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              {language === 'fr' ? 'Aucune demande de reservation' : 'No booking requests'}
            </h2>
            <p className="text-gray-600 mb-6">
              {language === 'fr' ? "Vous n'avez pas encore effectue de demande de reservation." : "You haven't made any booking requests yet."}
            </p>
            <button
              onClick={() => navigate('/recherche')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              {language === 'fr' ? 'Rechercher un logement' : 'Search for a listing'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className={`bg-white rounded-2xl shadow-sm hover:shadow-md transition overflow-hidden ${
                  needsPayment(booking) ? 'ring-2 ring-orange-400' : ''
                }`}
              >
                {needsPayment(booking) && (
                  <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white">
                      <CreditCard className="w-5 h-5" />
                      <span className="font-semibold text-sm">
                        {language === 'fr' ? 'Paiement requis pour confirmer votre reservation' : 'Payment required to confirm your booking'}
                      </span>
                    </div>
                    <CountdownTimer deadline={booking.payment_deadline!} language={language} />
                  </div>
                )}

                {isPaymentExpired(booking) && (
                  <div className="bg-red-500 px-6 py-3 flex items-center gap-2 text-white">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-semibold text-sm">
                      {language === 'fr'
                        ? 'Le delai de paiement est expire. Contactez le proprietaire pour une nouvelle reservation.'
                        : 'Payment deadline has expired. Contact the landlord for a new booking.'}
                    </span>
                  </div>
                )}

                <div className="flex flex-col md:flex-row">
                  <div
                    className="md:w-64 h-48 md:h-auto cursor-pointer"
                    onClick={() => navigate(`/logement/${booking.listing.id}`)}
                  >
                    {booking.listing.images && booking.listing.images.length > 0 ? (
                      <img
                        src={booking.listing.images[0].image_url}
                        alt={booking.listing.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                        <MapPin className="w-12 h-12 text-white opacity-50" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 p-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-4">
                      <div className="flex-1 mb-4 md:mb-0">
                        <h3
                          className="text-2xl font-bold text-gray-900 mb-2 cursor-pointer hover:text-blue-600 transition"
                          onClick={() => navigate(`/logement/${booking.listing.id}`)}
                        >
                          {booking.listing.title}
                        </h3>
                        <div className="flex items-center text-gray-600 mb-3">
                          <MapPin className="w-4 h-4 mr-1" />
                          <span>
                            {booking.listing.address}, {booking.listing.city}
                          </span>
                        </div>
                      </div>
                      {getStatusBadge(booking)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center space-x-3 text-gray-700 bg-gray-50 px-4 py-3 rounded-lg">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="text-xs text-gray-500 font-medium">{language === 'fr' ? 'Periode' : 'Period'}</p>
                          <p className="text-sm font-semibold">
                            {new Date(booking.start_date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB')} -{' '}
                            {new Date(booking.end_date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 text-gray-700 bg-gray-50 px-4 py-3 rounded-lg">
                        <Clock className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="text-xs text-gray-500 font-medium">{language === 'fr' ? 'Duree' : 'Duration'}</p>
                          <p className="text-sm font-semibold">{booking.total_days} {language === 'fr' ? 'jours' : 'days'}</p>
                        </div>
                      </div>
                    </div>

                    {needsPayment(booking) && booking.payment_amount && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                        <h4 className="font-semibold text-gray-900 mb-3 text-sm">
                          {language === 'fr' ? 'Detail du paiement' : 'Payment breakdown'}
                        </h4>
                        <div className="space-y-1.5 text-sm">
                          {booking.rent_amount && (
                            <div className="flex justify-between text-gray-700">
                              <span>{language === 'fr' ? 'Loyer (1er mois)' : 'Rent (1st month)'}</span>
                              <span className="font-medium">{booking.rent_amount.toFixed(2)} EUR</span>
                            </div>
                          )}
                          {booking.deposit_amount != null && booking.deposit_amount > 0 && (
                            <div className="flex justify-between text-gray-700">
                              <span>{language === 'fr' ? 'Caution' : 'Deposit'}</span>
                              <span className="font-medium">{booking.deposit_amount.toFixed(2)} EUR</span>
                            </div>
                          )}
                          {booking.platform_fee != null && booking.platform_fee > 0 && (
                            <div className="flex justify-between text-gray-700">
                              <span>{language === 'fr' ? 'Frais de plateforme' : 'Platform fees'}</span>
                              <span className="font-medium">{booking.platform_fee.toFixed(2)} EUR</span>
                            </div>
                          )}
                          <div className="pt-2 border-t border-orange-200">
                            <div className="flex justify-between font-bold text-gray-900">
                              <span>{language === 'fr' ? 'Total a payer' : 'Total to pay'}</span>
                              <span>{booking.payment_amount.toFixed(2)} EUR</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">{language === 'fr' ? 'Prix total' : 'Total price'}</p>
                        <p className="text-3xl font-bold text-gray-900">
                          {booking.payment_amount ? `${booking.payment_amount.toFixed(0)}` : booking.total_price.toFixed(0)}€
                        </p>
                      </div>
                      <div className="flex items-center space-x-3">
                        {needsPayment(booking) && (
                          <button
                            onClick={() => navigate(`/payment/${booking.id}`)}
                            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-bold hover:from-orange-600 hover:to-amber-600 transition shadow-lg hover:shadow-xl transform hover:scale-105"
                          >
                            <CreditCard className="w-5 h-5" />
                            <span>{language === 'fr' ? 'Payer maintenant' : 'Pay now'}</span>
                          </button>
                        )}

                        {isPaymentCompleted(booking) && (
                          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-200">
                            <CheckCircle className="w-5 h-5" />
                            <span className="font-semibold text-sm">{language === 'fr' ? 'Paiement effectue' : 'Payment completed'}</span>
                          </div>
                        )}

                        {booking.status === 'pending' && (
                          <button
                            onClick={() => cancelBooking(booking)}
                            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>{language === 'fr' ? 'Annuler' : 'Cancel'}</span>
                          </button>
                        )}

                        {!needsPayment(booking) && !isPaymentCompleted(booking) && booking.status !== 'pending' && (
                          <div className="text-right">
                            <p className="text-xs text-gray-500">{language === 'fr' ? 'Demande effectuee le' : 'Request made on'}</p>
                            <p className="text-sm font-medium text-gray-700">
                              {new Date(booking.created_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
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
