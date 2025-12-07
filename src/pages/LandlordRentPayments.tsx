import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, CheckCircle, Clock, Euro, Home, TrendingUp } from 'lucide-react';

interface RentPayment {
  id: string;
  booking_id: string;
  student_name: string;
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

interface PaymentStats {
  total_received: number;
  total_pending: number;
  total_overdue: number;
  payments_count: number;
}

export default function LandlordRentPayments() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [payments, setPayments] = useState<RentPayment[]>([]);
  const [stats, setStats] = useState<PaymentStats>({
    total_received: 0,
    total_pending: 0,
    total_overdue: 0,
    payments_count: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    loadPayments();
  }, [user]);

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
            ),
            student:profiles!student_id(
              first_name,
              last_name
            )
          )
        `)
        .eq('landlord_id', user!.id)
        .order('payment_date', { ascending: false });

      if (error) throw error;

      const formattedPayments = data.map((payment: any) => ({
        id: payment.id,
        booking_id: payment.booking_id,
        student_name: `${payment.booking.student.first_name} ${payment.booking.student.last_name}`,
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

      const totalReceived = updatedPayments
        .filter((p: RentPayment) => p.status === 'paid')
        .reduce((sum: number, p: RentPayment) => sum + p.rent_amount, 0);

      const totalPending = updatedPayments
        .filter((p: RentPayment) => p.status === 'pending')
        .reduce((sum: number, p: RentPayment) => sum + p.rent_amount, 0);

      const totalOverdue = updatedPayments
        .filter((p: RentPayment) => p.status === 'overdue')
        .reduce((sum: number, p: RentPayment) => sum + p.rent_amount, 0);

      setStats({
        total_received: totalReceived,
        total_pending: totalPending,
        total_overdue: totalOverdue,
        payments_count: updatedPayments.length,
      });
    } catch (error) {
      console.error('Erreur lors du chargement des paiements:', error);
    } finally {
      setLoading(false);
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
            <Clock className="w-4 h-4" />
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

  const paidPayments = payments.filter(p => p.status === 'paid');
  const pendingPayments = payments.filter(p => p.status === 'pending');
  const overduePayments = payments.filter(p => p.status === 'overdue');

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Loyers mensuels reçus</h1>
          <p className="text-gray-600">Suivez les paiements mensuels de vos locataires</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Total reçu</p>
              <Euro className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total_received.toFixed(2)} €</p>
            <p className="text-xs text-gray-500 mt-1">Loyers payés</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">En attente</p>
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total_pending.toFixed(2)} €</p>
            <p className="text-xs text-gray-500 mt-1">{pendingPayments.length} paiement(s)</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">En retard</p>
              <TrendingUp className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total_overdue.toFixed(2)} €</p>
            <p className="text-xs text-gray-500 mt-1">{overduePayments.length} paiement(s)</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Total paiements</p>
              <Calendar className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.payments_count}</p>
            <p className="text-xs text-gray-500 mt-1">Tous statuts</p>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Home className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Aucun paiement mensuel
            </h3>
            <p className="text-gray-600 mb-6">
              Vous n'avez pas encore de paiements mensuels programmés
            </p>
            <button
              onClick={() => navigate('/mes-demandes')}
              className="inline-flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors"
            >
              Voir mes réservations
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {overduePayments.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                  Paiements en retard ({overduePayments.length})
                </h2>
                <div className="space-y-4">
                  {overduePayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {payment.listing.title}
                            </h3>
                            {getStatusBadge(payment.status)}
                          </div>
                          <p className="text-gray-600 mb-1">{payment.student_name}</p>
                          <p className="text-sm text-gray-500 mb-4">{payment.listing.address}</p>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-sm text-gray-500">Mois</p>
                              <p className="font-medium text-gray-900">
                                {formatMonthYear(payment.month_year)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Date prévue</p>
                              <p className="font-medium text-gray-900">
                                {formatDate(payment.payment_date)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Montant</p>
                              <p className="font-medium text-gray-900">
                                {payment.rent_amount.toFixed(2)} €
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

            {pendingPayments.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                  Paiements en attente ({pendingPayments.length})
                </h2>
                <div className="space-y-4">
                  {pendingPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-yellow-500"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {payment.listing.title}
                            </h3>
                            {getStatusBadge(payment.status)}
                          </div>
                          <p className="text-gray-600 mb-1">{payment.student_name}</p>
                          <p className="text-sm text-gray-500 mb-4">{payment.listing.address}</p>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-sm text-gray-500">Mois</p>
                              <p className="font-medium text-gray-900">
                                {formatMonthYear(payment.month_year)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Date prévue</p>
                              <p className="font-medium text-gray-900">
                                {formatDate(payment.payment_date)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Montant</p>
                              <p className="font-medium text-gray-900">
                                {payment.rent_amount.toFixed(2)} €
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

            {paidPayments.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
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
                          <p className="text-gray-600 mb-1">{payment.student_name}</p>

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
                              <p className="text-sm text-gray-500">Montant reçu</p>
                              <p className="font-medium text-green-600">
                                {payment.rent_amount.toFixed(2)} €
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Frais plateforme</p>
                              <p className="font-medium text-gray-600">
                                {payment.platform_fee.toFixed(2)} €
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
