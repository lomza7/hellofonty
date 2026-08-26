import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Heart,
  MessageSquare,
  CreditCard,
  Search,
  FileText,
  User,
  HelpCircle,
  CheckCircle,
  AlertCircle,
  Shield,
  KeyRound,
  Lock,
  MapPin
} from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import QuickActionButton from '../components/dashboard/QuickActionButton';
import TaskList from '../components/dashboard/TaskList';
import ActivityTimeline from '../components/dashboard/ActivityTimeline';
import MiniChart from '../components/dashboard/MiniChart';
import PartnerOffersCarousel from '../components/PartnerOffersCarousel';
import BackButton from '../components/BackButton';

interface DashboardStats {
  activeBookings: number;
  favorites: number;
  unreadMessages: number;
  upcomingPayments: number;
}

interface Activity {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

interface Booking {
  id: string;
  listing_id: string;
  start_date: string;
  end_date: string;
  status: string;
  payment_status: string | null;
  listings: {
    title: string;
    address: string;
  };
}

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  status: string;
}

export default function DashboardStudent() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    activeBookings: 0,
    favorites: 0,
    unreadMessages: 0,
    upcomingPayments: 0
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [upcomingPayments, setUpcomingPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [monthlyExpenses] = useState([850, 900, 850, 920, 850, 900]);
  const [guideBooking, setGuideBooking] = useState<Booking | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/connexion');
      return;
    }

    if (profile?.role !== 'student') {
      navigate('/dashboard-proprietaire');
      return;
    }

    fetchDashboardData();
  }, [user, profile?.role, navigate]);

  useEffect(() => {
    if (!profile) return;

    let completion = 0;
    if (profile.avatar_url) completion += 33;
    if (profile.phone) completion += 33;
    if (profile.email_verified) completion += 34;
    setProfileCompletion(completion);
  }, [profile]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`profile_changes_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      const [
        bookingsRes,
        favoritesRes,
        messagesRes,
        paymentsRes,
        notificationsRes
      ] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, listing_id, start_date, end_date, status, payment_status, listings(title, address)')
          .eq('student_id', user.id)
          .in('status', ['confirmed', 'pending'])
          .order('start_date', { ascending: true }),

        supabase
          .from('favorites')
          .select('id')
          .eq('student_id', user.id),

        supabase
          .from('messages')
          .select('id')
          .eq('recipient_id', user.id)
          .eq('is_read', false),

        supabase
          .from('rent_payments')
          .select('*')
          .eq('student_id', user.id)
          .in('status', ['pending', 'overdue'])
          .gte('payment_date', new Date().toISOString().split('T')[0])
          .lte('payment_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('payment_date', { ascending: true }),

        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      setStats({
        activeBookings: bookingsRes.data?.length || 0,
        favorites: favoritesRes.data?.length || 0,
        unreadMessages: messagesRes.data?.length || 0,
        upcomingPayments: paymentsRes.data?.length || 0
      });

      setRecentBookings(bookingsRes.data?.slice(0, 3) || []);
      setUpcomingPayments(paymentsRes.data?.slice(0, 3) || []);

      const confirmedBookings = (bookingsRes.data || []).filter(
        (b: Booking) => b.status === 'confirmed'
      );
      const upcomingConfirmed = confirmedBookings
        .filter((b: Booking) => new Date(b.end_date) >= new Date())
        .sort((a: Booking, b: Booking) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
      setGuideBooking(upcomingConfirmed[0] || null);

      const activityData: Activity[] = (notificationsRes.data || []).map(notif => ({
        id: notif.id,
        type: notif.type || 'notification',
        message: notif.message || '',
        timestamp: notif.created_at
      }));
      setActivities(activityData);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-rose-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-blue-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <BackButton />
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Profile"
                className="h-20 w-20 rounded-full object-cover border-4 border-white shadow-lg"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-rose-400 to-pink-600 flex items-center justify-center border-4 border-white shadow-lg">
                <User className="h-10 w-10 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {t('dashboard.hello')}, {profile ? `${profile.first_name} ${profile.last_name}` : t('auth.student')} 👋
              </h1>
              <p className="text-gray-600 mt-1">
                {t('dashboard.student.subtitle')}
              </p>
              {profile?.email_verified && (
                <span className="inline-flex items-center gap-1 text-sm text-green-600 font-medium mt-2">
                  <CheckCircle className="h-4 w-4" />
                  {t('auth.verified')}
                </span>
              )}
            </div>
          </div>

          {profileCompletion < 100 && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900">
                  {t('dashboard.profileCompletion')}
                </span>
                <span className="text-sm font-bold text-rose-600">
                  {profileCompletion}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-rose-500 to-pink-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${profileCompletion}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {t('dashboard.completeProfile')}
              </p>
            </div>
          )}
        </div>

        {guideBooking && (
          <div className="mb-8">
            <AccessGuideCard booking={guideBooking} />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={Calendar}
            title={t('dashboard.student.activeBookings')}
            value={stats.activeBookings}
            iconColor="text-rose-600"
            iconBg="bg-rose-100"
          />
          <StatCard
            icon={Heart}
            title={t('dashboard.student.favorites')}
            value={stats.favorites}
            iconColor="text-pink-600"
            iconBg="bg-pink-100"
          />
          <StatCard
            icon={MessageSquare}
            title={t('dashboard.student.unreadMessages')}
            value={stats.unreadMessages}
            iconColor="text-blue-600"
            iconBg="bg-blue-100"
          />
          <StatCard
            icon={CreditCard}
            title={t('dashboard.student.upcomingPayments')}
            value={stats.upcomingPayments}
            iconColor="text-orange-600"
            iconBg="bg-orange-100"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              {user && <TaskList userId={user.id} maxDisplay={5} />}
            </div>

            {recentBookings.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">{t('dashboard.student.myBookings')}</h2>
                  <Link
                    to="/mes-reservations"
                    className="text-sm text-rose-600 hover:text-rose-700 font-medium"
                  >
                    {t('dashboard.seeAll')}
                  </Link>
                </div>
                <div className="space-y-4">
                  {recentBookings.map(booking => (
                    <div
                      key={booking.id}
                      className="block p-4 border-2 border-gray-100 rounded-xl hover:border-rose-200 hover:shadow-md transition-all"
                    >
                      <Link to={`/logement/${booking.listing_id}`} className="block">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 mb-1">
                              {booking.listings.title}
                            </h3>
                            <p className="text-sm text-gray-600 mb-2">
                              {booking.listings.address}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(booking.start_date).toLocaleDateString('fr-FR')} - {new Date(booking.end_date).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                            booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {booking.status === 'confirmed' ? t('dashboard.confirmed') :
                             booking.status === 'pending' ? t('auth.pendingVerification') :
                             booking.status}
                          </span>
                        </div>
                      </Link>
                      {booking.status === 'confirmed' && (
                        <button
                          onClick={() => navigate(`/mon-guide/${booking.id}`)}
                          className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm"
                        >
                          <KeyRound className="w-4 h-4" />
                          {t('dashboard.student.myBookings') ? 'Voir le guide d\'accès' : 'Voir le guide d\'accès'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <PartnerOffersCarousel targetAudience="student" />

            {monthlyExpenses.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{t('dashboard.monthlyExpenses')}</h2>
                    <p className="text-sm text-gray-600 mt-1">{t('dashboard.last6Months')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-gray-900">
                      {monthlyExpenses[monthlyExpenses.length - 1]}€
                    </p>
                    <p className="text-sm text-gray-600">{t('dashboard.thisMonth')}</p>
                  </div>
                </div>
                <MiniChart data={monthlyExpenses} height={80} color="rgb(244, 63, 94)" />
              </div>
            )}
          </div>

          <div className="space-y-8">
            {upcomingPayments.length > 0 && (
              <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl shadow-lg p-6 border-2 border-orange-200">
                <div className="flex items-start gap-3 mb-4">
                  <AlertCircle className="h-6 w-6 text-orange-600 flex-shrink-0 mt-1" />
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">{t('dashboard.student.upcomingPaymentsTitle')}</h2>
                    <p className="text-sm text-gray-600">{t('dashboard.next7Days')}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {upcomingPayments.map(payment => (
                    <div key={payment.id} className="bg-white rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-900">{payment.amount}€</span>
                        <span className="text-xs text-gray-600">
                          {new Date(payment.payment_date).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <Link
                        to="/mes-loyers"
                        className="block w-full bg-gradient-to-r from-rose-500 to-pink-600 text-white text-center py-2 rounded-lg hover:from-rose-600 hover:to-pink-700 transition-all font-medium text-sm"
                      >
                        {t('dashboard.student.pay')}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activities.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">{t('dashboard.recentActivity')}</h2>
                <ActivityTimeline activities={activities} />
              </div>
            )}

<div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">{t('dashboard.quickActions')}</h2>
              <div className="grid grid-cols-2 gap-3">
                <QuickActionButton
                  icon={Search}
                  label={t('nav.search')}
                  href="/recherche"
                  color="rose"
                />
                <QuickActionButton
                  icon={Heart}
                  label={t('nav.favorites')}
                  href="/favoris"
                  badge={stats.favorites}
                  color="pink"
                />
                <QuickActionButton
                  icon={MessageSquare}
                  label={t('nav.messages')}
                  href="/messages"
                  badge={stats.unreadMessages}
                  color="blue"
                />
                <QuickActionButton
                  icon={Calendar}
                  label={t('dashboard.student.myBookings')}
                  href="/mes-reservations"
                  badge={stats.activeBookings}
                  color="green"
                />
                <QuickActionButton
                  icon={CreditCard}
                  label={t('dashboard.myRents')}
                  href="/mes-loyers"
                  badge={stats.upcomingPayments}
                  color="orange"
                />
                <QuickActionButton
                  icon={FileText}
                  label={t('dashboard.student.myDocuments')}
                  href="/mes-documents"
                  color="purple"
                />
                <QuickActionButton
                  icon={Shield}
                  label="Mes cautions"
                  href="/mes-cautions"
                  color="rose"
                />
                <QuickActionButton
                  icon={User}
                  label={t('profile.title')}
                  href="/profil"
                  color="green"
                />
                <QuickActionButton
                  icon={KeyRound}
                  label="Guide d'accès"
                  href={guideBooking ? `/mon-guide/${guideBooking.id}` : '/mes-reservations'}
                  color="blue"
                />
                <QuickActionButton
                  icon={HelpCircle}
                  label={t('dashboard.help')}
                  href="/"
                  color="orange"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccessGuideCard({ booking }: { booking: Booking }) {
  const navigate = useNavigate();
  const arrival = new Date(booking.start_date + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const unlockAt = new Date(arrival.getTime() - 24 * 3600 * 1000);
  const isUnlocked = now >= unlockAt;
  const daysUntilArrival = Math.ceil((arrival.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const isPaid = booking.payment_status === 'completed';

  let state: 'locked-unpaid' | 'locked-paid' | 'unlocked';
  if (!isPaid) {
    state = 'locked-unpaid';
  } else if (isUnlocked) {
    state = 'unlocked';
  } else {
    state = 'locked-paid';
  }

  const styles = {
    'locked-unpaid': {
      container: 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300',
      icon: 'bg-amber-500',
      badge: 'bg-amber-100 text-amber-800',
      badgeText: 'Paiement requis',
      title: 'Votre guide d\'accès est en attente',
      buttonText: 'Payer mon premier loyer',
      buttonClass: 'bg-amber-600 text-white hover:bg-amber-700 shadow-md',
      action: () => navigate('/mes-reservations'),
    },
    'locked-paid': {
      container: 'bg-gradient-to-br from-slate-50 to-gray-50 border-gray-200',
      icon: 'bg-gray-400',
      badge: 'bg-gray-100 text-gray-600',
      badgeText: `Déverrouillage dans ${daysUntilArrival} jour${daysUntilArrival > 1 ? 's' : ''}`,
      title: 'Votre guide d\'accès',
      buttonText: 'Prévisualiser',
      buttonClass: 'bg-gray-200 text-gray-700 hover:bg-gray-300',
      action: () => navigate(`/mon-guide/${booking.id}`),
    },
    'unlocked': {
      container: 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300',
      icon: 'bg-blue-500',
      badge: 'bg-blue-100 text-blue-800',
      badgeText: 'Guide déverrouillé',
      title: 'Votre guide d\'accès est disponible',
      buttonText: 'Ouvrir le guide',
      buttonClass: 'bg-blue-600 text-white hover:bg-blue-700 shadow-md',
      action: () => navigate(`/mon-guide/${booking.id}`),
    },
  }[state];

  return (
    <div className={`rounded-2xl shadow-lg p-6 border-2 transition-all ${styles.container}`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center ${styles.icon}`}>
            {state === 'unlocked' ? (
              <KeyRound className="w-7 h-7 text-white" />
            ) : (
              <Lock className="w-7 h-7 text-white" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">{styles.title}</h2>
            <p className="text-sm text-gray-600 flex items-center gap-1 mb-1">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              {booking.listings.title} — {booking.listings.address}
            </p>
            <p className="text-sm text-gray-500">
              Arrivée le {arrival.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${styles.badge}`}>
            {state === 'unlocked' && <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>}
            {state !== 'unlocked' && <Lock className="w-3 h-3" />}
            {styles.badgeText}
          </span>
          <button
            onClick={styles.action}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition ${styles.buttonClass}`}
          >
            {state === 'unlocked' ? <KeyRound className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
            {styles.buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
