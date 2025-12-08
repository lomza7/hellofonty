import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Link, useNavigate } from 'react-router-dom';
import {
  Home,
  Calendar,
  MessageSquare,
  CreditCard,
  FileText,
  ClipboardList,
  TrendingUp,
  DollarSign,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  PlusCircle
} from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import QuickActionButton from '../components/dashboard/QuickActionButton';
import TaskList from '../components/dashboard/TaskList';
import ActivityTimeline from '../components/dashboard/ActivityTimeline';
import MiniChart from '../components/dashboard/MiniChart';

interface DashboardStats {
  totalRevenue: number;
  pendingPayments: number;
  activeBookings: number;
  occupancyRate: number;
}

interface Activity {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

interface Listing {
  id: string;
  title: string;
  status: string;
  views: number;
  favorites: number;
  bookings_count: number;
}

interface BookingRequest {
  id: string;
  student_id: string;
  listing_id: string;
  start_date: string;
  end_date: string;
  total_price: number;
  status: string;
  created_at: string;
  profiles: {
    full_name: string;
    avatar_url: string;
  };
  listings: {
    title: string;
  };
}

export default function DashboardLandlord() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    pendingPayments: 0,
    activeBookings: 0,
    occupancyRate: 0
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [recentListings, setRecentListings] = useState<Listing[]>([]);
  const [pendingRequests, setPendingRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthlyRevenue] = useState([2400, 2800, 2600, 3200, 2900, 3400]);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (profile?.role !== 'landlord') {
      navigate('/dashboard');
      return;
    }

    fetchDashboardData();
  }, [user, profile, navigate]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      const [
        listingsRes,
        bookingsRes,
        paymentsRes,
        messagesRes,
        notificationsRes,
        pendingRequestsRes
      ] = await Promise.all([
        supabase
          .from('listings')
          .select('*')
          .eq('landlord_id', user.id)
          .order('created_at', { ascending: false }),

        supabase
          .from('bookings')
          .select('*, listings!inner(landlord_id)')
          .eq('listings.landlord_id', user.id)
          .eq('status', 'confirmed'),

        supabase
          .from('rent_payments')
          .select('*, bookings!inner(listings!inner(landlord_id))')
          .eq('bookings.listings.landlord_id', user.id),

        supabase
          .from('messages')
          .select('id')
          .eq('receiver_id', user.id)
          .eq('read', false),

        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),

        supabase
          .from('bookings')
          .select('*, profiles!bookings_student_id_fkey(full_name, avatar_url), listings!inner(title, landlord_id)')
          .eq('listings.landlord_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
      ]);

      const listings = listingsRes.data || [];
      const bookings = bookingsRes.data || [];
      const payments = paymentsRes.data || [];

      const totalRevenue = payments
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + (p.landlord_amount || 0), 0);

      const pendingPayments = payments
        .filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + (p.landlord_amount || 0), 0);

      const totalDays = listings.length * 30;
      const bookedDays = bookings.length * 15;
      const occupancyRate = totalDays > 0 ? Math.round((bookedDays / totalDays) * 100) : 0;

      setStats({
        totalRevenue: Math.round(totalRevenue),
        pendingPayments: Math.round(pendingPayments),
        activeBookings: bookings.length,
        occupancyRate
      });

      setRecentListings(listings.slice(0, 5));
      setPendingRequests(pendingRequestsRes.data?.slice(0, 3) || []);
      setUnreadMessages(messagesRes.data?.length || 0);

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

  const handleAcceptBooking = async (bookingId: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', bookingId);

      if (error) throw error;

      await fetchDashboardData();
    } catch (error) {
      console.error('Error accepting booking:', error);
    }
  };

  const handleRejectBooking = async (bookingId: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'rejected' })
        .eq('id', bookingId);

      if (error) throw error;

      await fetchDashboardData();
    } catch (error) {
      console.error('Error rejecting booking:', error);
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Tableau de bord propriétaire 🏠
              </h1>
              <p className="text-gray-600 mt-1">
                Bienvenue, {profile?.full_name || 'Propriétaire'}
              </p>
            </div>
            <Link
              to="/add-listing"
              className="bg-gradient-to-r from-rose-500 to-pink-600 text-white px-6 py-3 rounded-xl hover:from-rose-600 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl flex items-center gap-2 font-semibold"
            >
              <PlusCircle className="h-5 w-5" />
              Nouvelle annonce
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={DollarSign}
            title="Revenus totaux"
            value={`${stats.totalRevenue}€`}
            variation={{ value: '+12%', positive: true }}
            iconColor="text-green-600"
            iconBg="bg-green-100"
          />
          <StatCard
            icon={Clock}
            title="Paiements en attente"
            value={`${stats.pendingPayments}€`}
            iconColor="text-orange-600"
            iconBg="bg-orange-100"
          />
          <StatCard
            icon={CheckCircle}
            title="Réservations actives"
            value={stats.activeBookings}
            iconColor="text-blue-600"
            iconBg="bg-blue-100"
          />
          <StatCard
            icon={TrendingUp}
            title="Taux d'occupation"
            value={`${stats.occupancyRate}%`}
            variation={{ value: '+5%', positive: true }}
            iconColor="text-rose-600"
            iconBg="bg-rose-100"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              {user && <TaskList userId={user.id} maxDisplay={5} />}
            </div>

            {pendingRequests.length > 0 && (
              <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl shadow-lg p-6 border-2 border-orange-200">
                <div className="flex items-start gap-3 mb-6">
                  <AlertCircle className="h-6 w-6 text-orange-600 flex-shrink-0 mt-1" />
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">Demandes en attente</h2>
                    <p className="text-sm text-gray-600">Réponse recommandée dans les 24h</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {pendingRequests.map(request => (
                    <div key={request.id} className="bg-white rounded-xl p-4">
                      <div className="flex items-start gap-4 mb-3">
                        {request.profiles.avatar_url ? (
                          <img
                            src={request.profiles.avatar_url}
                            alt={request.profiles.full_name}
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-rose-400 to-pink-600 flex items-center justify-center">
                            <Users className="h-6 w-6 text-white" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900">{request.profiles.full_name}</h3>
                          <p className="text-sm text-gray-600">{request.listings.title}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(request.start_date).toLocaleDateString('fr-FR')} - {new Date(request.end_date).toLocaleDateString('fr-FR')}
                          </p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {request.total_price}€
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcceptBooking(request.id)}
                          className="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors font-medium text-sm"
                        >
                          Accepter
                        </button>
                        <button
                          onClick={() => handleRejectBooking(request.id)}
                          className="flex-1 bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors font-medium text-sm"
                        >
                          Refuser
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recentListings.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
<div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Mes annonces</h2>
                  <Link
                    to="/mes-annonces"
                    className="text-sm text-rose-600 hover:text-rose-700 font-medium"
                  >
                    Voir tout →
                  </Link>
                </div>
                <div className="space-y-3">
                  {recentListings.map(listing => (
                    <Link
                      key={listing.id}
                      to={`/logement/${listing.id}`}
                      className="block p-4 border-2 border-gray-100 rounded-xl hover:border-rose-200 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-2">{listing.title}</h3>
                          <div className="flex items-center gap-4 text-xs text-gray-600">
                            <span>👁️ {listing.views || 0} vues</span>
                            <span>❤️ {listing.favorites || 0} favoris</span>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          listing.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {listing.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {monthlyRevenue.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Revenus mensuels</h2>
                    <p className="text-sm text-gray-600 mt-1">Évolution sur les 6 derniers mois</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-gray-900">
                      {monthlyRevenue[monthlyRevenue.length - 1]}€
                    </p>
                    <p className="text-sm text-gray-600">Ce mois</p>
                  </div>
                </div>
                <MiniChart data={monthlyRevenue} height={80} color="rgb(34, 197, 94)" />
              </div>
            )}
          </div>

          <div className="space-y-8">
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
                  icon={Home}
                  label="Mes annonces"
                  href="/mes-annonces"
                  color="rose"
                />
                <QuickActionButton
                  icon={Calendar}
                  label="Calendrier"
                  href="/mes-annonces"
                  color="blue"
                />
                <QuickActionButton
                  icon={MessageSquare}
                  label="Messages"
                  href="/messages"
                  badge={unreadMessages}
                  color="green"
                />
                <QuickActionButton
                  icon={Users}
                  label="Demandes"
                  href="/mes-demandes"
                  badge={pendingRequests.length}
                  color="orange"
                />
                <QuickActionButton
                  icon={CreditCard}
                  label="Paiements"
                  href="/proprietaire/loyers"
                  color="purple"
                />
                <QuickActionButton
                  icon={FileText}
                  label="Documents"
                  href="/documents-proprietaire"
                  color="yellow"
                />
                <QuickActionButton
                  icon={ClipboardList}
                  label="Baux"
                  href="/mes-baux"
                  color="blue"
                />
                <QuickActionButton
                  icon={CheckCircle}
                  label="Inventaires"
                  href="/inventory"
                  color="green"
                />
                <QuickActionButton
                  icon={DollarSign}
                  label="Virements"
                  href="/proprietaire/paiements"
                  color="green"
                />
                <QuickActionButton
                  icon={FileSignature}
                  label="Guide d'accès"
                  href="/guide-acces"
                  color="purple"
                />
                <QuickActionButton
                  icon={User}
                  label="Mon profil"
                  href="/profil"
                  color="rose"
                />
                <QuickActionButton
                  icon={CreditCard}
                  label="Abonnement"
                  href="/mon-abonnement"
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
