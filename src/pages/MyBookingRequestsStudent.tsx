import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Clock, CheckCircle, XCircle, AlertCircle, Trash2 } from 'lucide-react';
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

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .in('type', ['booking_request', 'booking_confirmed', 'booking_cancelled'])
      .eq('is_read', false);

    if (!error) {
      console.log('Notifications réservations marquées comme lues');
    }
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
    if (!confirm(language === 'fr' ? 'Voulez-vous vraiment annuler cette demande de réservation ?' : 'Are you sure you want to cancel this booking request?')) {
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

    const messageContent = `❌ Demande de réservation annulée

L'étudiant a annulé sa demande de réservation.

Période: ${new Date(booking.start_date).toLocaleDateString('fr-FR')} - ${new Date(booking.end_date).toLocaleDateString('fr-FR')}
Durée: ${booking.total_days} jour${booking.total_days > 1 ? 's' : ''}
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
      title: 'Demande annulée',
      message: `${profile!.first_name} ${profile!.last_name} a annulé sa demande de réservation pour ${booking.listing.title}`,
      link: `/bookings/${booking.id}`,
    });

    loadBookings();
    alert(language === 'fr' ? 'Demande annulée avec succès!' : 'Request cancelled successfully!');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
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
            <span className="text-sm font-medium">{language === 'fr' ? 'Confirmée' : 'Confirmed'}</span>
          </div>
        );
      case 'cancelled':
        return (
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-red-100 text-red-800 rounded-full">
            <XCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{language === 'fr' ? 'Annulée' : 'Cancelled'}</span>
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
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{language === 'fr' ? 'Mes demandes de réservation' : 'My booking requests'}</h1>
          <p className="text-lg text-gray-600">
            {language === 'fr' ? "Suivez l'état de toutes vos demandes de réservation" : 'Track the status of all your booking requests'}
          </p>
        </div>

        {bookings.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              {language === 'fr' ? 'Aucune demande de réservation' : 'No booking requests'}
            </h2>
            <p className="text-gray-600 mb-6">
              {language === 'fr' ? "Vous n'avez pas encore effectué de demande de réservation." : "You haven't made any booking requests yet."}
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
                className="bg-white rounded-2xl shadow-sm hover:shadow-md transition overflow-hidden"
              >
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
                      {getStatusBadge(booking.status)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center space-x-3 text-gray-700 bg-gray-50 px-4 py-3 rounded-lg">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="text-xs text-gray-500 font-medium">{language === 'fr' ? 'Période' : 'Period'}</p>
                          <p className="text-sm font-semibold">
                            {new Date(booking.start_date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB')} -{' '}
                            {new Date(booking.end_date).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 text-gray-700 bg-gray-50 px-4 py-3 rounded-lg">
                        <Clock className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="text-xs text-gray-500 font-medium">{language === 'fr' ? 'Durée' : 'Duration'}</p>
                          <p className="text-sm font-semibold">{booking.total_days} {language === 'fr' ? 'jours' : 'days'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">{language === 'fr' ? 'Prix total' : 'Total price'}</p>
                        <p className="text-3xl font-bold text-gray-900">
                          {booking.total_price.toFixed(0)}€
                        </p>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-xs text-gray-500">{language === 'fr' ? 'Demande effectuée le' : 'Request made on'}</p>
                          <p className="text-sm font-medium text-gray-700">
                            {new Date(booking.created_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB')}
                          </p>
                        </div>
                        {booking.status === 'pending' && (
                          <button
                            onClick={() => cancelBooking(booking)}
                            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>{language === 'fr' ? 'Annuler' : 'Cancel'}</span>
                          </button>
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
