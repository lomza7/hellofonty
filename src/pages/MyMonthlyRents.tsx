import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  CreditCard,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Home,
  MapPin,
  Timer,
  XCircle,
  ChevronDown,
  ChevronUp,
  Shield,
} from 'lucide-react';
import BackButton from '../components/BackButton';

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
}

interface BookingListing {
  id: string;
  title: string;
  address: string;
  price_per_month: number;
  images: Array<{ image_url: string }>;
}

interface Booking {
  id: string;
  listing_id: string;
  start_date: string;
  end_date: string;
  status: string;
  payment_status: string;
  payment_amount: number;
  payment_deadline: string | null;
  rent_amount: number;
  deposit_amount: number;
  platform_fee: number;
  service_fee: number;
  listing: BookingListing;
}

interface ScheduledPayment {
  month_year: string;
  payment_date: string;
  rent_amount: number;
  platform_fee: number;
  total_amount: number;
  status: 'pending' | 'paid' | 'overdue';
  is_initial: boolean;
  rent_payment_id?: string;
  booking_id: string;
}

function CountdownTimer({ deadline }: { deadline: string }) {
  const { language } = useLanguage();
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

      if (hours < 2) setUrgency('critical');
      else if (hours < 6) setUrgency('warning');
      else setUrgency('normal');

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
      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-medium">
        <XCircle className="w-4 h-4" />
        <span>{language === 'fr' ? 'Delai expire' : 'Deadline expired'}</span>
      </div>
    );
  }

  const colors = {
    normal: 'bg-blue-50 text-blue-800 border-blue-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    critical: 'bg-red-50 text-red-800 border-red-200 animate-pulse',
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-bold tabular-nums ${colors[urgency]}`}>
      <Timer className="w-4 h-4" />
      <span>{timeLeft}</span>
    </div>
  );
}

function BookingPaymentCard({
  booking,
  schedule,
  onPayInitial,
  onPayRent,
  processingPayment,
}: {
  booking: Booking;
  schedule: ScheduledPayment[];
  onPayInitial: (bookingId: string) => void;
  onPayRent: (paymentId: string) => void;
  processingPayment: string | null;
}) {
  const { language } = useLanguage();
  const [expanded, setExpanded] = useState(true);

  const needsInitialPayment = booking.payment_status === 'pending' && booking.payment_deadline;
  const isInitialExpired = needsInitialPayment && new Date(booking.payment_deadline!) <= new Date();
  const isInitialPayable = needsInitialPayment && !isInitialExpired;
  const initialPaid = booking.payment_status === 'completed';

  const paidCount = schedule.filter(p => p.status === 'paid').length;
  const pendingCount = schedule.filter(p => p.status === 'pending' || p.status === 'overdue').length;
  const totalScheduled = schedule.reduce((sum, p) => sum + p.total_amount, 0);

  const platformFee = booking.platform_fee || booking.service_fee || 0;

  const listingImage = booking.listing.images?.[0]?.image_url;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {isInitialPayable && (
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <CreditCard className="w-5 h-5" />
            <span className="font-semibold text-sm">
              {language === 'fr' ? 'Paiement requis pour finaliser votre reservation' : 'Payment required to finalize your booking'}
            </span>
          </div>
          <CountdownTimer deadline={booking.payment_deadline!} />
        </div>
      )}

      {isInitialExpired && (
        <div className="bg-red-500 px-6 py-3 flex items-center gap-2 text-white">
          <AlertCircle className="w-5 h-5" />
          <span className="font-semibold text-sm">
            {language === 'fr'
              ? 'Le delai de paiement est expire. Contactez le proprietaire.'
              : 'Payment deadline has expired. Contact the landlord.'}
          </span>
        </div>
      )}

      <div className="p-6">
        <div className="flex gap-4 mb-6">
          {listingImage ? (
            <img
              src={listingImage}
              alt={booking.listing.title}
              className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-shrink-0">
              <Home className="w-8 h-8 text-gray-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-900 truncate">{booking.listing.title}</h3>
            <div className="flex items-center gap-1 text-gray-500 text-sm mt-0.5">
              <MapPin className="w-3.5 h-3.5" />
              <span className="truncate">{booking.listing.address}</span>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {new Date(booking.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  {' - '}
                  {new Date(booking.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <div className="text-sm text-gray-500">{language === 'fr' ? 'Loyer mensuel' : 'Monthly rent'}</div>
            <div className="text-xl font-bold text-gray-900">{booking.listing.price_per_month} EUR</div>
            <div className="flex items-center gap-2 mt-1 justify-end">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <CheckCircle className="w-3 h-3" />
                {paidCount}
              </span>
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                  <Clock className="w-3 h-3" />
                  {pendingCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {isInitialPayable && (
          <div className="mb-6 bg-orange-50 border-2 border-orange-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-orange-600" />
                  {language === 'fr' ? 'Premier paiement - Entree dans le logement' : 'First payment - Move-in'}
                </h4>
                <div className="space-y-1.5 text-sm">
                  {booking.rent_amount > 0 && (
                    <div className="flex justify-between text-gray-700">
                      <span>{language === 'fr' ? 'Loyer (1er mois, au prorata)' : 'Rent (1st month, prorated)'}</span>
                      <span className="font-medium">{booking.rent_amount.toFixed(2)} EUR</span>
                    </div>
                  )}
                  {booking.deposit_amount > 0 && (
                    <div className="flex justify-between text-gray-700">
                      <span>{language === 'fr' ? 'Caution' : 'Deposit'}</span>
                      <span className="font-medium">{booking.deposit_amount.toFixed(2)} EUR</span>
                    </div>
                  )}
                  {platformFee > 0 && (
                    <div className="flex justify-between text-gray-700">
                      <span>{language === 'fr' ? 'Frais de plateforme' : 'Platform fees'}</span>
                      <span className="font-medium">{platformFee.toFixed(2)} EUR</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-orange-200">
                    <div className="flex justify-between font-bold text-gray-900 text-base">
                      <span>{language === 'fr' ? 'Total a payer' : 'Total due'}</span>
                      <span>{booking.payment_amount.toFixed(2)} EUR</span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onPayInitial(booking.id)}
                disabled={processingPayment === booking.id}
                className="flex-shrink-0 flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {processingPayment === booking.id ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    <span>{language === 'fr' ? 'Traitement...' : 'Processing...'}</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    <span>{language === 'fr' ? 'Payer maintenant' : 'Pay now'}</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              <Shield className="w-3.5 h-3.5" />
              <span>{language === 'fr' ? 'Transaction securisee par Stripe' : 'Secure transaction via Stripe'}</span>
            </div>
          </div>
        )}

        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-between w-full text-left mb-3"
          >
            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              {language === 'fr' ? 'Echeancier des paiements' : 'Payment schedule'}
              <span className="text-sm font-normal text-gray-500">({schedule.length})</span>
            </h4>
            {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>

          {expanded && (
            <div className="space-y-2">
              {schedule.map((payment, index) => {
                const isOverdue = payment.status === 'overdue';
                const isPending = payment.status === 'pending';
                const isPaid = payment.status === 'paid';
                const canPay = (isPending || isOverdue) && !payment.is_initial && payment.rent_payment_id;

                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between py-3 px-4 rounded-lg border transition-colors ${
                      isPaid
                        ? 'bg-green-50 border-green-200'
                        : isOverdue
                        ? 'bg-red-50 border-red-200'
                        : isPending && payment.is_initial && isInitialPayable
                        ? 'bg-orange-50 border-orange-200'
                        : isPending && payment.is_initial && initialPaid
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isPaid || (payment.is_initial && initialPaid)
                          ? 'bg-green-200 text-green-700'
                          : isOverdue
                          ? 'bg-red-200 text-red-700'
                          : isPending && payment.is_initial && isInitialPayable
                          ? 'bg-orange-200 text-orange-700'
                          : 'bg-gray-200 text-gray-500'
                      }`}>
                        {isPaid || (payment.is_initial && initialPaid)
                          ? <CheckCircle className="w-4 h-4" />
                          : isOverdue
                          ? <AlertCircle className="w-4 h-4" />
                          : <Clock className="w-4 h-4" />
                        }
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 text-sm">
                            {formatMonthYear(payment.month_year)}
                          </span>
                          {payment.is_initial && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                              {language === 'fr' ? '1er paiement' : '1st payment'}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {language === 'fr' ? 'Echeance' : 'Due'}: {formatDate(payment.payment_date)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="font-bold text-gray-900">{payment.total_amount.toFixed(2)} EUR</span>
                        {!payment.is_initial && (
                          <p className="text-xs text-gray-500">
                            {payment.rent_amount.toFixed(0)} + {payment.platform_fee.toFixed(0)} {language === 'fr' ? 'frais' : 'fees'}
                          </p>
                        )}
                      </div>

                      {canPay && (
                        <button
                          onClick={() => onPayRent(payment.rent_payment_id!)}
                          disabled={processingPayment === payment.rent_payment_id}
                          className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {processingPayment === payment.rent_payment_id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          ) : (
                            <CreditCard className="w-4 h-4" />
                          )}
                          <span>{language === 'fr' ? 'Payer' : 'Pay'}</span>
                        </button>
                      )}

                      {payment.is_initial && isInitialPayable && (
                        <span className="text-xs font-medium text-orange-600 px-3 py-1 bg-orange-100 rounded-full">
                          {language === 'fr' ? 'A payer ci-dessus' : 'Pay above'}
                        </span>
                      )}

                      {(isPaid || (payment.is_initial && initialPaid)) && (
                        <span className="text-xs font-medium text-green-700 px-3 py-1 bg-green-100 rounded-full">
                          {language === 'fr' ? 'Paye' : 'Paid'}
                        </span>
                      )}

                      {isOverdue && !canPay && !payment.is_initial && (
                        <span className="text-xs font-medium text-red-700 px-3 py-1 bg-red-100 rounded-full">
                          {language === 'fr' ? 'En retard' : 'Overdue'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="mt-3 pt-3 border-t-2 border-gray-200">
                <div className="flex justify-between items-center px-4">
                  <span className="text-base font-bold text-gray-900">
                    {language === 'fr' ? 'Total echeancier' : 'Total schedule'}
                  </span>
                  <span className="text-xl font-bold text-gray-900">
                    {totalScheduled.toFixed(2)} EUR
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatMonthYear(monthYear: string) {
  const [year, month] = monthYear.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
  });
}

export default function MyMonthlyRents() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const [bookingsWithSchedule, setBookingsWithSchedule] = useState<Array<Booking & { schedule: ScheduledPayment[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    loadBookings();
  }, [user]);

  const generatePaymentSchedule = useCallback(async (booking: Booking): Promise<ScheduledPayment[]> => {
    const schedule: ScheduledPayment[] = [];
    const startDate = new Date(booking.start_date);
    const endDate = new Date(booking.end_date);
    const monthlyRent = booking.listing.price_per_month;
    const now = new Date();

    const { data: rentPayments } = await supabase
      .from('rent_payments')
      .select('*')
      .eq('booking_id', booking.id);

    const rentPaymentsMap = new Map(
      (rentPayments || []).map((rp: RentPayment) => [rp.month_year, rp])
    );

    const { data: settings } = await supabase
      .from('platform_settings')
      .select('platform_fee_amount')
      .maybeSingle();

    const platformFeeAmount = settings?.platform_fee_amount || 0;

    const paymentDeadline = booking.payment_deadline ? new Date(booking.payment_deadline) : null;
    const isInitialPaid = booking.payment_status === 'completed';
    const isInitialOverdue = booking.payment_status === 'pending' && paymentDeadline && paymentDeadline < now;

    const startMonthYear = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    schedule.push({
      month_year: startMonthYear,
      payment_date: booking.payment_deadline || booking.start_date,
      rent_amount: booking.rent_amount,
      platform_fee: booking.platform_fee || booking.service_fee || 0,
      total_amount: booking.payment_amount,
      status: isInitialPaid ? 'paid' : isInitialOverdue ? 'overdue' : 'pending',
      is_initial: true,
      booking_id: booking.id,
    });

    let currentDate = new Date(startDate);
    currentDate.setDate(1);
    currentDate.setMonth(currentDate.getMonth() + 1);

    while (currentDate < endDate) {
      const monthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      const paymentDate = new Date(currentDate);
      paymentDate.setDate(5);

      const existingPayment = rentPaymentsMap.get(monthYear);

      let status: 'pending' | 'paid' | 'overdue' = 'pending';
      if (existingPayment) {
        if (existingPayment.status === 'paid') {
          status = 'paid';
        } else if (existingPayment.status === 'pending' && paymentDate < now) {
          status = 'overdue';
        }
      } else if (paymentDate < now && isInitialPaid) {
        status = 'overdue';
      }

      schedule.push({
        month_year: monthYear,
        payment_date: paymentDate.toISOString().split('T')[0],
        rent_amount: monthlyRent,
        platform_fee: platformFeeAmount,
        total_amount: monthlyRent + platformFeeAmount,
        status,
        is_initial: false,
        rent_payment_id: existingPayment?.id,
        booking_id: booking.id,
      });

      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return schedule;
  }, []);

  const loadBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          listing:listings(
            id,
            title,
            address,
            price_per_month,
            images:listing_images(image_url)
          )
        `)
        .eq('student_id', user!.id)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const bookingsWithSchedules = await Promise.all(
        (data || []).map(async (booking: any) => {
          const schedule = await generatePaymentSchedule(booking);
          return { ...booking, schedule };
        })
      );

      setBookingsWithSchedule(bookingsWithSchedules.filter(b => b.schedule.length > 0));
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayInitial = async (bookingId: string) => {
    try {
      setProcessingPayment(bookingId);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non authentifie');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-booking-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ booking_id: bookingId }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erreur lors du paiement');
      if (data.url) window.location.href = data.url;
    } catch (error: any) {
      console.error('Error:', error);
      alert(error.message || 'Erreur lors du paiement');
    } finally {
      setProcessingPayment(null);
    }
  };

  const handlePayRent = async (paymentId: string) => {
    try {
      setProcessingPayment(paymentId);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non authentifie');

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
      if (!response.ok) throw new Error(data.error || 'Erreur lors du paiement');
      if (data.url) window.location.href = data.url;
    } catch (error: any) {
      console.error('Error:', error);
      alert(error.message || 'Erreur lors du paiement');
    } finally {
      setProcessingPayment(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {language === 'fr' ? 'Chargement des paiements...' : 'Loading payments...'}
          </p>
        </div>
      </div>
    );
  }

  const urgentBookings = bookingsWithSchedule.filter(
    b => b.payment_status === 'pending' && b.payment_deadline && new Date(b.payment_deadline) > new Date()
  );
  const otherBookings = bookingsWithSchedule.filter(
    b => !urgentBookings.find(u => u.id === b.id)
  );

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <BackButton />

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {language === 'fr' ? 'Mes loyers' : 'My rent payments'}
          </h1>
          <p className="text-gray-600">
            {language === 'fr'
              ? 'Gerez et payez vos loyers pour tous vos logements'
              : 'Manage and pay rent for all your properties'}
          </p>
        </div>

        {urgentBookings.length > 0 && (
          <div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="font-semibold text-orange-900">
                {language === 'fr'
                  ? `${urgentBookings.length} paiement${urgentBookings.length > 1 ? 's' : ''} en attente`
                  : `${urgentBookings.length} pending payment${urgentBookings.length > 1 ? 's' : ''}`}
              </p>
              <p className="text-sm text-orange-700">
                {language === 'fr'
                  ? 'Effectuez vos paiements avant la fin du delai pour confirmer votre reservation.'
                  : 'Complete your payments before the deadline to confirm your booking.'}
              </p>
            </div>
          </div>
        )}

        {bookingsWithSchedule.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <Home className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {language === 'fr' ? 'Aucun paiement' : 'No payments'}
            </h3>
            <p className="text-gray-600 mb-6">
              {language === 'fr'
                ? "Vous n'avez pas encore de reservation confirmee. Une fois votre reservation acceptee par le proprietaire, vos paiements apparaitront ici."
                : "You don't have any confirmed bookings yet. Once your booking is accepted, your payments will appear here."}
            </p>
            <button
              onClick={() => navigate('/my-booking-requests-student')}
              className="inline-flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors font-semibold"
            >
              {language === 'fr' ? 'Voir mes reservations' : 'View my bookings'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {urgentBookings.map((booking) => (
              <BookingPaymentCard
                key={booking.id}
                booking={booking}
                schedule={booking.schedule}
                onPayInitial={handlePayInitial}
                onPayRent={handlePayRent}
                processingPayment={processingPayment}
              />
            ))}
            {otherBookings.map((booking) => (
              <BookingPaymentCard
                key={booking.id}
                booking={booking}
                schedule={booking.schedule}
                onPayInitial={handlePayInitial}
                onPayRent={handlePayRent}
                processingPayment={processingPayment}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
