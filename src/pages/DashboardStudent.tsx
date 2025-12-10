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
  TrendingUp,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import QuickActionButton from '../components/dashboard/QuickActionButton';
import TaskList from '../components/dashboard/TaskList';
import ActivityTimeline from '../components/dashboard/ActivityTimeline';
import MiniChart from '../components/dashboard/MiniChart';
import PartnerOffersCarousel from '../components/PartnerOffersCarousel';

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
  listings: {
    title: string;
    address: string;
  };
}

interface Payment {
  id: string;
  amount: number;
  due_date: string;
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

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (profile?.role !== 'student') {
      navigate('/dashboard-proprietaire');
      return;
    }

    fetchDashboardData();
  }, [user, profile, navigate]);

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
          .select('*, listings(title, address)')
          .eq('student_id', user.id)
          .in('status', ['confirmed', 'pending'])
          .order('start_date', { ascending: true }),

        supabase
          .from('favorites')
          .select('id')
          .eq('user_id', user.id),

        supabase
          .from('messages')
          .select('id')
          .eq('recipient_id', user.id)
          .eq('is_read', false),

        supabase
          .from('rent_payments')
          .select('*')
          .eq('student_id', user.id)
          .eq('status', 'pending')
          .gte('due_date', new Date().toISOString())
          .lte('due_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('due_date', { ascending: true }),

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

      const activityData: Activity[] = (notificationsRes.data || []).map(notif => ({
        id: notif.id,
        type: notif.type || 'notification',
        message: notif.message || '',
        timestamp: notif.created_at
      }));
      setActivities(activityData);

      let completion = 0;
      if (profile?.avatar_url) completion += 33;
      if (profile?.phone_number) completion += 33;
      if (profile?.email_verified) completion += 34;
      setProfileCompletion(completion);

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
                Bonjour, {profile ? `${profile.first_name} ${profile.last_name}` : t('auth.student')} 👋
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
                  Complétude du profil
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
                Complétez votre profil pour maximiser vos chances de trouver un logement
              </p>
            </div>
          )}
        </div>

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
                    Voir tout →
                  </Link>
                </div>
                <div className="space-y-4">
                  {recentBookings.map(booking => (
                    <Link
                      key={booking.id}
                      to={`/logement/${booking.listing_id}`}
                      className="block p-4 border-2 border-gray-100 rounded-xl hover:border-rose-200 hover:shadow-md transition-all"
                    >
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
                          {booking.status === 'confirmed' ? 'Confirmée' :
                           booking.status === 'pending' ? t('auth.pendingVerification') :
                           booking.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <PartnerOffersCarousel targetAudience="student" />

            {monthlyExpenses.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Dépenses mensuelles</h2>
                    <p className="text-sm text-gray-600 mt-1">Évolution sur les 6 derniers mois</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-gray-900">
                      {monthlyExpenses[monthlyExpenses.length - 1]}€
                    </p>
                    <p className="text-sm text-gray-600">Ce mois</p>
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
                    <p className="text-sm text-gray-600">Dans les 7 prochains jours</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {upcomingPayments.map(payment => (
                    <div key={payment.id} className="bg-white rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-900">{payment.amount}€</span>
                        <span className="text-xs text-gray-600">
                          {new Date(payment.due_date).toLocaleDateString('fr-FR')}
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
                <h2 className="text-xl font-bold text-gray-900 mb-6">Activité récente</h2>
                <ActivityTimeline activities={activities} />
              </div>
            )}

<div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Actions rapides</h2>
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
                  label="Mes loyers"
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
                  icon={User}
                  label={t('profile.title')}
                  href="/profil"
                  color="green"
                />
                <QuickActionButton
                  icon={HelpCircle}
                  label="Aide"
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
