import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CreditCard, Clock, Euro, Shield, ArrowLeft, CheckCircle, AlertCircle, Home } from 'lucide-react';
import BackButton from '../components/BackButton';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type Booking = {
  id: string;
  student_id: string;
  listing_id: string;
  start_date: string;
  end_date: string;
  status: string;
  payment_status: string;
  payment_deadline: string;
  payment_amount: number;
  rent_amount: number;
  deposit_amount: number;
  platform_fee: number;
  is_first_month_partial?: boolean;
  prorated_rent?: number;
  listing?: {
    title: string;
    address: string;
    images: Array<{ image_url: string }>;
    landlord: {
      avatar_url: string | null;
    };
  };
};

export default function Payment() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState('');
  const [studentFeeAmount, setStudentFeeAmount] = useState(0);

  useEffect(() => {
    loadBooking();
  }, [bookingId, profile]);

  useEffect(() => {
    if (booking?.payment_deadline) {
      const interval = setInterval(() => {
        const deadline = new Date(booking.payment_deadline);
        const now = new Date();
        const diff = deadline.getTime() - now.getTime();

        if (diff <= 0) {
          setTimeLeft('Expiré');
          clearInterval(interval);
        } else {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

          if (days > 0) {
            setTimeLeft(`${days}j ${hours}h ${minutes}m`);
          } else {
            setTimeLeft(`${hours}h ${minutes}m`);
          }
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [booking]);

  async function loadBooking() {
    try {
      setLoading(true);
      setError('');

      if (!profile) {
        setError('Vous devez être connecté pour accéder à cette page');
        return;
      }

      const [bookingResult, feeResult] = await Promise.all([
        supabase
          .from('bookings')
          .select(`
            *,
            listing:listings(
              title,
              address,
              price_per_month,
              security_deposit,
              images:listing_images(image_url),
              landlord:profiles!landlord_id(avatar_url)
            )
          `)
          .eq('id', bookingId)
          .maybeSingle(),
        supabase
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', 'platform_fee_amount')
          .maybeSingle(),
      ]);

      if (bookingResult.error) throw bookingResult.error;
      const data = bookingResult.data;

      if (feeResult.data?.setting_value) {
        setStudentFeeAmount(parseFloat(feeResult.data.setting_value));
      }

      if (!data) {
        setError('Réservation introuvable');
        return;
      }

      if (data.student_id !== profile.id) {
        setError('Vous n\'avez pas accès à cette réservation');
        return;
      }

      if (data.status !== 'confirmed') {
        setError('Cette réservation n\'a pas été confirmée');
        return;
      }

      if (data.payment_status === 'completed') {
        setError('Cette réservation a déjà été payée');
        return;
      }

      if (data.payment_status === 'expired') {
        setError('Le délai de paiement a expiré');
        return;
      }

      setBooking(data);
    } catch (err: any) {
      console.error('Erreur lors du chargement:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePayment() {
    if (!booking || !profile) return;

    try {
      setProcessing(true);
      setError('');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Non authentifié');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-booking-payment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            booking_id: booking.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création du paiement');
      }

      window.location.href = data.url;
    } catch (err: any) {
      console.error('Erreur:', err);
      setError(err.message);
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Erreur</h2>
          <p className="text-gray-600 mb-6">{error || 'Une erreur est survenue'}</p>
          <button
            onClick={() => navigate('/messages')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Retour aux messages
          </button>
        </div>
      </div>
    );
  }

  const isExpired = new Date(booking.payment_deadline) < new Date();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <BackButton />

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Finaliser votre réservation</h1>
                <p className="text-blue-100 mt-1">Paiement sécurisé</p>
              </div>
            </div>

            {!isExpired && (
              <div className="flex items-center gap-3 bg-white/10 rounded-lg p-4 backdrop-blur">
                <Clock className="w-5 h-5" />
                <div>
                  <p className="text-sm text-blue-100">Temps restant</p>
                  <p className="font-bold text-xl">{timeLeft}</p>
                </div>
              </div>
            )}

            {isExpired && (
              <div className="flex items-center gap-3 bg-red-500/20 rounded-lg p-4 backdrop-blur border border-red-300">
                <AlertCircle className="w-5 h-5" />
                <p className="font-semibold">Le délai de paiement a expiré</p>
              </div>
            )}
          </div>

          <div className="p-8">
            {booking.listing && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Détails du logement</h2>
                <div className="flex gap-4">
                  {(() => {
                    const listingImage = booking.listing.images?.[0]?.image_url;
                    const landlordAvatar = booking.listing.landlord?.avatar_url;
                    const imageUrl = listingImage || landlordAvatar;

                    return imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={booking.listing.title}
                        className="w-32 h-32 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                        <Home className="w-12 h-12 text-blue-600" />
                      </div>
                    );
                  })()}
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900">{booking.listing.title}</h3>
                    <p className="text-gray-600 text-sm">{booking.listing.address}</p>
                    <div className="mt-2 flex gap-4 text-sm">
                      <span className="text-gray-600">
                        Du {new Date(booking.start_date).toLocaleDateString('fr-FR')}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="text-gray-600">
                        Au {new Date(booking.end_date).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-gray-50 rounded-xl p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Récapitulatif du paiement</h2>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-gray-700">
                  <span>Loyer</span>
                  <span className="font-semibold">{booking.rent_amount.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Caution</span>
                  <span className="font-semibold">{booking.deposit_amount.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Frais de réservation Hellofonty</span>
                  <span className="font-semibold">{studentFeeAmount.toFixed(2)} €</span>
                </div>
              </div>

              <div className="pt-4 border-t-2 border-gray-300">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold text-gray-900">Total à payer</span>
                  <span className="text-3xl font-bold text-blue-600">
                    {booking.payment_amount.toFixed(2)} €
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
              <div className="flex gap-3">
                <Shield className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-blue-900 mb-2">Paiement sécurisé</h3>
                  <ul className="text-sm text-blue-800 space-y-2">
                    <li>✓ Transaction sécurisée par Stripe</li>
                    <li>✓ La caution est remboursée à la fin du séjour</li>
                    <li>✓ Protection des acheteurs</li>
                    <li>✓ Support client disponible 7j/7</li>
                  </ul>
                </div>
              </div>
            </div>

            {!isExpired && (
              <button
                onClick={handlePayment}
                disabled={processing}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Traitement en cours...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    <span>Payer {booking.payment_amount.toFixed(2)} €</span>
                  </>
                )}
              </button>
            )}

            {isExpired && (
              <div className="text-center py-4">
                <p className="text-gray-600 mb-4">
                  Le délai de paiement est expiré. Veuillez contacter le propriétaire pour une nouvelle réservation.
                </p>
                <button
                  onClick={() => navigate('/messages')}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                >
                  Retour aux messages
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
