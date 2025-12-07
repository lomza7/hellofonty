import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CreditCard, Calendar, CheckCircle, Clock, AlertCircle, Home } from 'lucide-react';

interface RentPayment {
  id: string;
  booking_id: string;
  rent_amount: number;
  platform_fee: number;
  total_amount: number;
  payment_date: string;
  month_year: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  paid_at: string | null;
  listing: {
    title: string;
    address: string;
  };
}

interface Booking {
  id: string;
  listing_id: string;
  start_date: string;
  end_date: string;
  status: string;
  payment_status: string;
  listing: {
    title: string;
    address: string;
    price_per_month: number;
  };
}

interface ScheduledPayment {
  month_year: string;
  payment_date: string;
  rent_amount: number;
  platform_fee: number;
  total_amount: number;
}

export default function MyMonthlyRents() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [payments, setPayments] = useState<RentPayment[]>([]);
  const [bookingsWithSchedule, setBookingsWithSchedule] = useState<Array<Booking & { schedule: ScheduledPayment[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    loadPayments();
    loadConfirmedBookings();
  }, [user]);

  const generatePaymentSchedule = async (booking: Booking): Promise<ScheduledPayment[]> => {
    const schedule: ScheduledPayment[] = [];
    const startDate = new Date(booking.start_date);
    const endDate = new Date(booking.end_date);
    const monthlyRent = booking.listing.price_per_month;

    const { data: settings } = await supabase
      .from('platform_settings')
      .select('platform_fee_amount')
      .maybeSingle();

    const platformFee = settings?.platform_fee_amount || 0;

    let currentDate = new Date(startDate);
    currentDate.setDate(1);
    currentDate.setMonth(currentDate.getMonth() + 1);

    while (currentDate < endDate) {
      const monthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      const paymentDate = new Date(currentDate);
      paymentDate.setDate(5);

      schedule.push({
        month_year: monthYear,
        payment_date: paymentDate.toISOString().split('T')[0],
        rent_amount: monthlyRent,
        platform_fee: platformFee,
        total_amount: monthlyRent + platformFee,
      });

      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return schedule;
  };

  const loadConfirmedBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          listing:listings(
            title,
            address,
            price_per_month
          )
        `)
        .eq('student_id', user!.id)
        .eq('status', 'confirmed')
        .neq('payment_status', 'completed');

      if (error) throw error;

      const bookingsWithSchedules = await Promise.all(
        data.map(async (booking: any) => {
          const schedule = await generatePaymentSchedule(booking);
          return {
            ...booking,
            schedule,
          };
        })
      );

      setBookingsWithSchedule(bookingsWithSchedules.filter(b => b.schedule.length > 0));
    } catch (error) {
      console.error('Erreur lors du chargement des réservations:', error);
    }
  };

  const loadPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('rent_payments')
        .select(`
          *,
          booking:bookings(
            listing:listings(
              title,
              address
            )
          )
        `)
        .eq('student_id', user!.id)
        .order('payment_date', { ascending: true });

      if (error) throw error;

      const formattedPayments = data.map((payment: any) => ({
        id: payment.id,
        booking_id: payment.booking_id,
        rent_amount: payment.rent_amount,
        platform_fee: payment.platform_fee,
        total_amount: payment.total_amount,
        payment_date: payment.payment_date,
        month_year: payment.month_year,
        status: payment.status,
        paid_at: payment.paid_at,
        listing: {
          title: payment.booking.listing.title,
          address: payment.booking.listing.address,
        },
      }));

      const now = new Date();
      const updatedPayments = formattedPayments.map((payment: RentPayment) => {
        if (payment.status === 'pending' && new Date(payment.payment_date) < now) {
          return { ...payment, status: 'overdue' as const };
        }
        return payment;
      });

      setPayments(updatedPayments);
    } catch (error) {
      console.error('Erreur lors du chargement des paiements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayRent = async (paymentId: string) => {
    try {
      setProcessingPayment(paymentId);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Non authentifié');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-monthly-rent-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ payment_id: paymentId }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors du paiement');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Erreur:', error);
      alert(error.message || 'Erreur lors du paiement');
    } finally {
      setProcessingPayment(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-4 h-4" />
            Payé
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-4 h-4" />
            En attente
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
            <AlertCircle className="w-4 h-4" />
            En retard
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            Annulé
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatMonthYear = (monthYear: string) => {
    const [year, month] = monthYear.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des paiements...</p>
        </div>
      </div>
    );
  }

  const pendingPayments = payments.filter(p => p.status === 'pending' || p.status === 'overdue');
  const paidPayments = payments.filter(p => p.status === 'paid');

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Mes loyers mensuels</h1>
          <p className="text-gray-600">Gérez et payez vos loyers mensuels</p>
        </div>

        {payments.length === 0 && bookingsWithSchedule.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Home className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Aucun paiement mensuel
            </h3>
            <p className="text-gray-600 mb-6">
              Vous n'avez pas encore de paiements mensuels programmés
            </p>
            <button
              onClick={() => navigate('/my-booking-requests-student')}
              className="inline-flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors"
            >
              Voir mes réservations
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {bookingsWithSchedule.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Échéancier prévisionnel ({bookingsWithSchedule.reduce((sum, b) => sum + b.schedule.length, 0)} paiements)
                </h2>
                <div className="space-y-6">
                  {bookingsWithSchedule.map((booking) => (
                    <div key={booking.id} className="bg-blue-50 rounded-lg shadow-sm p-6 border-2 border-blue-200">
                      <div className="mb-4">
                        <div className="flex items-center gap-3 mb-2">
                          <Calendar className="w-5 h-5 text-blue-600" />
                          <h3 className="text-lg font-semibold text-gray-900">
                            {booking.listing.title}
                          </h3>
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                            Prévisionnel
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm">{booking.listing.address}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Du {new Date(booking.start_date).toLocaleDateString('fr-FR')} au {new Date(booking.end_date).toLocaleDateString('fr-FR')}
                        </p>
                      </div>

                      <div className="bg-white rounded-lg p-4">
                        <div className="space-y-3">
                          {booking.schedule.map((payment, index) => (
                            <div key={index} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                              <div>
                                <p className="font-medium text-gray-900">{formatMonthYear(payment.month_year)}</p>
                                <p className="text-sm text-gray-500">Échéance: {formatDate(payment.payment_date)}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-gray-900">{payment.total_amount.toFixed(2)} €</p>
                                <p className="text-xs text-gray-500">
                                  Loyer: {payment.rent_amount.toFixed(2)} € + Frais: {payment.platform_fee.toFixed(2)} €
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 pt-4 border-t-2 border-gray-300">
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-bold text-gray-900">Total échéancier</span>
                            <span className="text-2xl font-bold text-blue-600">
                              {booking.schedule.reduce((sum, p) => sum + p.total_amount, 0).toFixed(2)} €
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 bg-blue-100 rounded-lg p-3 text-sm text-blue-800">
                        <p className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          Cet échéancier sera activé après le paiement initial de votre réservation
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingPayments.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Paiements à effectuer ({pendingPayments.length})
                </h2>
                <div className="space-y-4">
                  {pendingPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-orange-500"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {payment.listing.title}
                            </h3>
                            {getStatusBadge(payment.status)}
                          </div>
                          <p className="text-gray-600 mb-4">{payment.listing.address}</p>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                              <p className="text-sm text-gray-500">Mois</p>
                              <p className="font-medium text-gray-900">
                                {formatMonthYear(payment.month_year)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Date de paiement</p>
                              <p className="font-medium text-gray-900">
                                {formatDate(payment.payment_date)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Montant</p>
                              <p className="font-medium text-gray-900">
                                {payment.total_amount.toFixed(2)} €
                              </p>
                            </div>
                          </div>

                          <div className="bg-gray-50 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-gray-600">Loyer</span>
                              <span className="font-medium">{payment.rent_amount.toFixed(2)} €</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Frais de plateforme</span>
                              <span className="font-medium">{payment.platform_fee.toFixed(2)} €</span>
                            </div>
                            <div className="border-t border-gray-200 mt-2 pt-2">
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-gray-900">Total</span>
                                <span className="font-semibold text-gray-900">
                                  {payment.total_amount.toFixed(2)} €
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="ml-6">
                          <button
                            onClick={() => handlePayRent(payment.id)}
                            disabled={processingPayment === payment.id}
                            className="inline-flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            {processingPayment === payment.id ? (
                              <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Traitement...
                              </>
                            ) : (
                              <>
                                <CreditCard className="w-5 h-5" />
                                Payer maintenant
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {paidPayments.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Historique des paiements ({paidPayments.length})
                </h2>
                <div className="space-y-4">
                  {paidPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="bg-white rounded-lg shadow-sm p-6"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {payment.listing.title}
                            </h3>
                            {getStatusBadge(payment.status)}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-sm text-gray-500">Mois</p>
                              <p className="font-medium text-gray-900">
                                {formatMonthYear(payment.month_year)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Payé le</p>
                              <p className="font-medium text-gray-900">
                                {payment.paid_at ? formatDate(payment.paid_at) : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Montant</p>
                              <p className="font-medium text-gray-900">
                                {payment.total_amount.toFixed(2)} €
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
