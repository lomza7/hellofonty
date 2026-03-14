import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Calendar,
  CheckCircle,
  Clock,
  Euro,
  Home,
  TrendingUp,
  Filter,
  Download,
  Eye,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import BackButton from '../components/BackButton';

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

interface PendingBooking {
  id: string;
  start_date: string;
  end_date: string;
  total_months: number;
  total_price: number;
  payment_status: string;
  payment_deadline: string;
  student_name: string;
  listing: {
    title: string;
    address: string;
    monthly_price: number;
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
  const [filteredPayments, setFilteredPayments] = useState<RentPayment[]>([]);
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [stats, setStats] = useState<PaymentStats>({
    total_received: 0,
    total_pending: 0,
    total_overdue: 0,
    payments_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'table'>('table');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'property'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    loadPayments();
  }, [user]);

  useEffect(() => {
    console.log('=== Début du filtrage ===');
    console.log('Nombre total de paiements:', payments.length);
    console.log('Filtres actifs:', { filterStatus, filterYear, filterMonth, sortBy, sortOrder });

    let filtered = [...payments];

    if (filterStatus !== 'all') {
      console.log('Filtrage par statut:', filterStatus);
      filtered = filtered.filter(p => p.status === filterStatus);
      console.log('Après filtre statut:', filtered.length);
    }

    if (filterYear !== 'all') {
      console.log('Filtrage par année:', filterYear);
      filtered = filtered.filter(p => p.month_year.startsWith(filterYear));
      console.log('Après filtre année:', filtered.length);
    }

    if (filterMonth !== 'all') {
      console.log('Filtrage par mois:', filterMonth);
      filtered = filtered.filter(p => p.month_year.endsWith(`-${filterMonth}`));
      console.log('Après filtre mois:', filtered.length);
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime();
          break;
        case 'amount':
          comparison = a.rent_amount - b.rent_amount;
          break;
        case 'property':
          comparison = a.listing.title.localeCompare(b.listing.title);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    console.log('Résultat final après tri:', filtered.length, 'paiements');
    console.log('=== Fin du filtrage ===\n');

    setFilteredPayments(filtered);
  }, [payments, filterStatus, filterYear, filterMonth, sortBy, sortOrder]);

  const toggleRowExpansion = (paymentId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(paymentId)) {
      newExpanded.delete(paymentId);
    } else {
      newExpanded.add(paymentId);
    }
    setExpandedRows(newExpanded);
  };

  const getAvailableYears = () => {
    const years = new Set(payments.map(p => p.month_year.split('-')[0]));
    return Array.from(years).sort().reverse();
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Mois', 'Propriété', 'Étudiant', 'Loyer', 'Frais', 'Net', 'Statut'];
    const rows = filteredPayments.map(p => [
      formatDate(p.payment_date),
      formatMonthYear(p.month_year),
      p.listing.title,
      p.student_name,
      p.rent_amount.toFixed(2),
      p.platform_fee.toFixed(2),
      (p.rent_amount - p.platform_fee).toFixed(2),
      p.status
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loyers-mensuels-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const loadPayments = async () => {
    try {
      // Charger les paiements mensuels
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

      // Charger d'abord toutes les réservations du propriétaire
      const { data: allListings, error: listingsError } = await supabase
        .from('listings')
        .select('id')
        .eq('landlord_id', user!.id);

      if (listingsError) throw listingsError;

      const listingIds = (allListings || []).map(l => l.id);
      console.log('Listings du propriétaire:', listingIds);

      let bookingsData = null;
      let bookingsError = null;

      // Charger les réservations confirmées en attente de premier paiement
      if (listingIds.length > 0) {
        const result = await supabase
          .from('bookings')
          .select(`
            id,
            start_date,
            end_date,
            total_months,
            total_price,
            payment_status,
            payment_deadline,
            status,
            listing:listings(
              title,
              address,
              price_per_month
            ),
            student:profiles!student_id(
              first_name,
              last_name
            )
          `)
          .in('listing_id', listingIds)
          .eq('status', 'confirmed')
          .order('payment_deadline', { ascending: true });

        bookingsData = result.data;
        bookingsError = result.error;

        if (bookingsError) {
          console.error('Erreur chargement réservations:', bookingsError);
        }
      }

      console.log('Toutes les réservations confirmées:', bookingsData);
      console.log('Nombre de réservations:', bookingsData?.length);

      // Filtrer uniquement celles en attente de paiement
      const pendingBookingsData = (bookingsData || []).filter((booking: any) =>
        booking.payment_status === 'pending' ||
        booking.payment_status === 'awaiting_payment' ||
        !booking.payment_status
      );

      console.log('Réservations en attente de paiement:', pendingBookingsData);

      const formattedBookings = pendingBookingsData.map((booking: any) => ({
        id: booking.id,
        start_date: booking.start_date,
        end_date: booking.end_date,
        total_months: booking.total_months,
        total_price: booking.total_price,
        payment_status: booking.payment_status,
        payment_deadline: booking.payment_deadline,
        student_name: `${booking.student.first_name} ${booking.student.last_name}`,
        listing: {
          title: booking.listing.title,
          address: booking.listing.address,
          monthly_price: booking.listing.price_per_month,
        },
      }));

      console.log('Réservations formatées:', formattedBookings);

      setPendingBookings(formattedBookings);

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

      let totalPending = updatedPayments
        .filter((p: RentPayment) => p.status === 'pending')
        .reduce((sum: number, p: RentPayment) => sum + p.rent_amount, 0);

      let totalOverdue = updatedPayments
        .filter((p: RentPayment) => p.status === 'overdue')
        .reduce((sum: number, p: RentPayment) => sum + p.rent_amount, 0);

      formattedBookings.forEach((booking: any) => {
        const deadline = new Date(booking.payment_deadline);
        const totalPrice = parseFloat(booking.total_price);
        if (deadline < now) {
          totalOverdue += totalPrice;
        } else {
          totalPending += totalPrice;
        }
      });

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

  const paidPayments = filteredPayments.filter(p => p.status === 'paid');
  const pendingPayments = filteredPayments.filter(p => p.status === 'pending');
  const overduePayments = filteredPayments.filter(p => p.status === 'overdue');

  const totalNet = filteredPayments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + (p.rent_amount - p.platform_fee), 0);

  const totalFees = filteredPayments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + p.platform_fee, 0);

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <BackButton />
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Échéancier des loyers</h1>
              <p className="text-gray-600">Suivi complet des paiements mensuels de vos locataires</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={exportToCSV}
                disabled={filteredPayments.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Exporter CSV
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Total reçu (brut)</p>
              <Euro className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total_received.toFixed(2)} €</p>
            <p className="text-xs text-gray-500 mt-1">{paidPayments.length} loyer(s) payé(s)</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Net perçu</p>
              <TrendingUp className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-900">{totalNet.toFixed(2)} €</p>
            <p className="text-xs text-gray-500 mt-1">Après frais plateforme</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">En attente</p>
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total_pending.toFixed(2)} €</p>
            <p className="text-xs text-gray-500 mt-1">{pendingPayments.length} paiement(s)</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">En retard</p>
              <TrendingUp className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total_overdue.toFixed(2)} €</p>
            <p className="text-xs text-gray-500 mt-1">{overduePayments.length} paiement(s)</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-gray-500">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Frais plateforme</p>
              <FileText className="w-5 h-5 text-gray-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalFees.toFixed(2)} €</p>
            <p className="text-xs text-gray-500 mt-1">Total prélevé</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filtres et tri</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Statut
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">Tous</option>
                <option value="paid">Payés</option>
                <option value="pending">En attente</option>
                <option value="overdue">En retard</option>
                <option value="cancelled">Annulés</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Année
              </label>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">Toutes</option>
                {getAvailableYears().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mois
              </label>
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">Tous</option>
                <option value="01">Janvier</option>
                <option value="02">Février</option>
                <option value="03">Mars</option>
                <option value="04">Avril</option>
                <option value="05">Mai</option>
                <option value="06">Juin</option>
                <option value="07">Juillet</option>
                <option value="08">Août</option>
                <option value="09">Septembre</option>
                <option value="10">Octobre</option>
                <option value="11">Novembre</option>
                <option value="12">Décembre</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trier par
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'amount' | 'property')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="date">Date</option>
                <option value="amount">Montant</option>
                <option value="property">Propriété</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ordre
              </label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="desc">Décroissant</option>
                <option value="asc">Croissant</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {filteredPayments.length} paiement(s) affiché(s) sur {payments.length}
            </p>
            <button
              onClick={() => {
                setFilterStatus('all');
                setFilterYear('all');
                setFilterMonth('all');
                setSortBy('date');
                setSortOrder('desc');
              }}
              className="text-sm text-orange-600 hover:text-orange-700 font-medium"
            >
              Réinitialiser les filtres
            </button>
          </div>
        </div>

        {pendingBookings.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
            <div className="px-6 py-4 border-b border-gray-200 bg-orange-50">
              <div className="flex items-center gap-3">
                <div className="bg-orange-500 text-white p-2 rounded-lg">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    En attente du premier paiement
                  </h2>
                  <p className="text-sm text-gray-600">
                    {pendingBookings.length} réservation(s) acceptée(s)
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Logement
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Période
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Loyer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date limite
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pendingBookings.map((booking) => {
                    const deadline = booking.payment_deadline ? new Date(booking.payment_deadline) : null;
                    const now = new Date();
                    const isOverdue = deadline && deadline < now;
                    const daysRemaining = deadline ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

                    return (
                      <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Home className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {booking.listing.title}
                              </p>
                              <p className="text-sm text-gray-500 truncate">{booking.student_name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatDate(booking.start_date)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDate(booking.end_date)}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {booking.total_months} mois
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {booking.listing.monthly_price.toFixed(2)} €
                          </div>
                          <div className="text-xs text-gray-500">par mois</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-base font-semibold text-gray-900">
                            {booking.total_price.toFixed(2)} €
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {deadline ? (
                            <>
                              <div className={`text-sm font-medium ${
                                isOverdue ? 'text-red-600' : daysRemaining && daysRemaining <= 3 ? 'text-orange-600' : 'text-gray-900'
                              }`}>
                                {formatDate(booking.payment_deadline)}
                              </div>
                              {isOverdue ? (
                                <div className="flex items-center gap-1 mt-1">
                                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                  <span className="text-xs font-medium text-red-600">En retard</span>
                                </div>
                              ) : daysRemaining && daysRemaining <= 3 ? (
                                <div className="flex items-center gap-1 mt-1">
                                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                                  <span className="text-xs font-medium text-orange-600">{daysRemaining}j restants</span>
                                </div>
                              ) : (
                                <div className="text-xs text-gray-500 mt-1">
                                  {daysRemaining} jours restants
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-sm text-gray-400 italic">Non définie</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => navigate(`/messages?booking=${booking.id}`)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-xs font-medium"
                            >
                              Relancer
                            </button>
                            <button
                              onClick={() => navigate('/mes-demandes')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-xs font-medium"
                            >
                              Voir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 bg-blue-50 border-t border-gray-200">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-1">Que se passe-t-il après le paiement ?</p>
                  <p className="text-xs text-blue-700">
                    Une fois que l'étudiant effectue le premier paiement, tous les loyers mensuels seront automatiquement créés dans votre échéancier ci-dessous. Chaque loyer sera dû le 1er de chaque mois.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {payments.length === 0 && pendingBookings.length === 0 ? (
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
        ) : payments.length > 0 ? (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Échéancier des loyers mensuels
              </h2>
              <p className="text-gray-600">
                Tous les paiements mensuels générés après le premier paiement initial
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Détails
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Mois
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Date échéance
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Loyer brut
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Frais
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Net perçu
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPayments.map((payment) => (
                    <>
                      <tr
                        key={payment.id}
                        className={`hover:bg-gray-50 transition-colors ${
                          payment.status === 'overdue' ? 'bg-red-50' :
                          payment.status === 'pending' ? 'bg-yellow-50' : ''
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-1">
                              <Home className="w-5 h-5 text-gray-400" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {payment.listing.title}
                              </p>
                              <p className="text-sm text-gray-600 mt-0.5">
                                {payment.student_name}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {payment.listing.address}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-900">
                              {formatMonthYear(payment.month_year)}
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-900">
                            {formatDate(payment.payment_date)}
                          </span>
                          {payment.status === 'paid' && payment.paid_at && (
                            <p className="text-xs text-green-600 mt-1">
                              Payé le {formatDate(payment.paid_at)}
                            </p>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-gray-900">
                            {payment.rent_amount.toFixed(2)} €
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">
                            {payment.platform_fee.toFixed(2)} €
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-blue-600">
                            {(payment.rent_amount - payment.platform_fee).toFixed(2)} €
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          {getStatusBadge(payment.status)}
                        </td>

                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => toggleRowExpansion(payment.id)}
                            className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 font-medium"
                          >
                            {expandedRows.has(payment.id) ? (
                              <>
                                <ChevronUp className="w-4 h-4" />
                                Masquer
                              </>
                            ) : (
                              <>
                                <Eye className="w-4 h-4" />
                                Détails
                              </>
                            )}
                          </button>
                        </td>
                      </tr>

                      {expandedRows.has(payment.id) && (
                        <tr className="bg-gray-50">
                          <td colSpan={8} className="px-6 py-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div className="bg-white rounded-lg p-4 border border-gray-200">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                  <FileText className="w-4 h-4" />
                                  Détails financiers
                                </h4>
                                <div className="space-y-2">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Loyer brut :</span>
                                    <span className="font-medium text-gray-900">
                                      {payment.rent_amount.toFixed(2)} €
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Frais plateforme :</span>
                                    <span className="font-medium text-red-600">
                                      - {payment.platform_fee.toFixed(2)} €
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                                    <span className="text-gray-900 font-semibold">Net perçu :</span>
                                    <span className="font-bold text-blue-600">
                                      {(payment.rent_amount - payment.platform_fee).toFixed(2)} €
                                    </span>
                                  </div>
                                  {payment.status === 'paid' && (
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                      <p className="text-xs text-gray-600">
                                        Le montant net sera viré sur votre compte bancaire selon les conditions de votre contrat Stripe Connect
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="bg-white rounded-lg p-4 border border-gray-200">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                  <Calendar className="w-4 h-4" />
                                  Informations temporelles
                                </h4>
                                <div className="space-y-2">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Période :</span>
                                    <span className="font-medium text-gray-900">
                                      {formatMonthYear(payment.month_year)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Date échéance :</span>
                                    <span className="font-medium text-gray-900">
                                      {formatDate(payment.payment_date)}
                                    </span>
                                  </div>
                                  {payment.paid_at && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-600">Date de paiement :</span>
                                      <span className="font-medium text-green-600">
                                        {formatDate(payment.paid_at)}
                                      </span>
                                    </div>
                                  )}
                                  {payment.status === 'overdue' && (
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                      <p className="text-xs text-red-600 font-medium">
                                        Ce paiement est en retard. Veuillez contacter votre locataire.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="bg-white rounded-lg p-4 border border-gray-200">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                  <Home className="w-4 h-4" />
                                  Informations réservation
                                </h4>
                                <div className="space-y-2">
                                  <div>
                                    <p className="text-xs text-gray-600 mb-1">Propriété :</p>
                                    <p className="text-sm font-medium text-gray-900">
                                      {payment.listing.title}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-600 mb-1">Locataire :</p>
                                    <p className="text-sm font-medium text-gray-900">
                                      {payment.student_name}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-600 mb-1">Adresse :</p>
                                    <p className="text-sm text-gray-700">
                                      {payment.listing.address}
                                    </p>
                                  </div>
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <button
                                      onClick={() => navigate(`/messages?booking=${payment.booking_id}`)}
                                      className="w-full text-sm text-orange-600 hover:text-orange-700 font-medium"
                                    >
                                      Contacter le locataire
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

              {filteredPayments.length === 0 && payments.length > 0 && (
                <div className="p-12 text-center">
                  <Filter className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">
                    Aucun paiement ne correspond aux filtres sélectionnés
                  </p>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
