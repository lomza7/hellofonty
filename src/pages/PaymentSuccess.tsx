import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Home, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = searchParams.get('booking_id');

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<any>(null);

  useEffect(() => {
    if (bookingId) {
      loadBooking();
    }
  }, [bookingId]);

  async function loadBooking() {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          listing:listings(title, address)
        `)
        .eq('id', bookingId)
        .maybeSingle();

      if (!error && data) {
        setBooking(data);
      }
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Vérification du paiement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-white text-center">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h1 className="text-4xl font-bold mb-2">Paiement réussi !</h1>
            <p className="text-green-100 text-lg">
              Votre réservation est maintenant confirmée
            </p>
          </div>

          <div className="p-8">
            {booking && booking.listing && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
                  Détails de votre réservation
                </h2>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
                  <h3 className="font-bold text-xl text-gray-900 mb-2">
                    {booking.listing.title}
                  </h3>
                  <p className="text-gray-600 mb-4">{booking.listing.address}</p>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 mb-1">Date d'arrivée</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(booking.start_date).toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">Date de départ</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(booking.end_date).toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-blue-300">
                    <p className="text-gray-500 mb-1">Montant payé</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {booking.payment_amount?.toFixed(2)} €
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 mb-8">
              <h3 className="font-bold text-yellow-900 mb-3 text-lg">
                📧 Prochaines étapes
              </h3>
              <ul className="space-y-2 text-yellow-800">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 font-bold">1.</span>
                  <span>Vous recevrez un email de confirmation avec tous les détails</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 font-bold">2.</span>
                  <span>Le propriétaire vous contactera pour les modalités d'arrivée</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 font-bold">3.</span>
                  <span>La caution sera remboursée automatiquement à la fin du séjour</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => navigate('/messages')}
                className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl"
              >
                <MessageCircle className="w-5 h-5" />
                <span>Voir mes messages</span>
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all"
              >
                <Home className="w-5 h-5" />
                <span>Retour à l'accueil</span>
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Une question ? Notre équipe est disponible 7j/7 pour vous aider
        </p>
      </div>
    </div>
  );
}
