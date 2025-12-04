import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Users, Home, Calendar, MessageSquare, FileText, Shield, Search, Filter, CheckCircle, XCircle, Eye, Clock, TrendingUp, BarChart3, Trash2, DollarSign, Euro, CreditCard, Percent, Tag, MapPin, Edit3, AlertTriangle, Ban } from 'lucide-react';
import PricingPlansManager from '../components/PricingPlansManager';
import BlockedMessageDetailsModal from '../components/BlockedMessageDetailsModal';
import { getDetectionTypeLabel, getDetectionTypeBadgeColor } from '../utils/messageDetection';

interface UserData {
  id: string;
  email: string;
  role: string;
  first_name: string;
  last_name: string;
  phone: string;
  phone_verified: boolean;
  is_verified: boolean;
  verification_status: string;
  created_at: string;
  last_sign_in_at: string;
  subscription_plan?: string;
}

interface AdminStats {
  totalUsers: number;
  totalStudents: number;
  totalLandlords: number;
  totalListings: number;
  totalBookings: number;
  pendingVerifications: number;
}

interface AnalyticsData {
  userGrowth: { date: string; count: number }[];
  listingGrowth: { date: string; count: number }[];
  bookingGrowth: { date: string; count: number }[];
  dailyActivity: { date: string; users: number; listings: number; bookings: number }[];
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  booking_id?: string;
  listing_id?: string;
}

interface Conversation {
  user1_id: string;
  user2_id: string;
  user1_name: string;
  user2_name: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  messages: Message[];
}

interface FinanceStats {
  totalRevenue: number;
  bookingRevenue: number;
  subscriptionRevenue: number;
  mrr: number;
  arr: number;
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  conversionRate: number;
  freeSubscribers: number;
  premiumSubscribers: number;
  revenueGrowth: { date: string; revenue: number; bookings: number; subscriptions: number }[];
}

type AdminProps = {
  onNavigate: (page: string, id?: string) => void;
};

export default function Admin({ onNavigate }: AdminProps) {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'users' | 'verifications' | 'analytics' | 'messaging' | 'finance' | 'pricing' | 'listings'>('users');
  const [pendingVerifications, setPendingVerifications] = useState<UserData[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [verificationDocument, setVerificationDocument] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageSearch, setMessageSearch] = useState('');
  const [financeStats, setFinanceStats] = useState<FinanceStats | null>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [listingsSearch, setListingsSearch] = useState('');
  const [listingsFilter, setListingsFilter] = useState<string>('all');
  const [messagingSubTab, setMessagingSubTab] = useState<'conversations' | 'alerts'>('conversations');
  const [blockedMessages, setBlockedMessages] = useState<any[]>([]);
  const [blockedStats, setBlockedStats] = useState<any>(null);
  const [selectedBlockedMessage, setSelectedBlockedMessage] = useState<any>(null);
  const [showBlockedDetailsModal, setShowBlockedDetailsModal] = useState(false);
  const [alertsFilter, setAlertsFilter] = useState<string>('all');

  useEffect(() => {
    if (!profile || profile.role !== 'admin') {
      return;
    }

    loadAdminData();
  }, [profile]);

  async function loadAdminData() {
    try {
      // Load all users with their auth data
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Get auth data and subscriptions for each user
      const usersWithAuth = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: { user } } = await supabase.auth.admin.getUserById(profile.id);

          // Get subscription data
          const { data: subscription } = await supabase
            .from('subscriptions')
            .select('plan_type')
            .eq('user_id', profile.id)
            .maybeSingle();

          return {
            ...profile,
            email: user?.email || 'N/A',
            last_sign_in_at: user?.last_sign_in_at || profile.created_at,
            subscription_plan: subscription?.plan_type || (profile.role === 'landlord' ? 'free' : null),
          };
        })
      );

      setUsers(usersWithAuth);

      // Load pending verifications
      const pendingUsers = usersWithAuth.filter(u => u.verification_status === 'pending');
      setPendingVerifications(pendingUsers);

      // Load stats
      const [
        { count: totalListings },
        { count: totalBookings },
        { count: pendingVerifications }
      ] = await Promise.all([
        supabase.from('listings').select('*', { count: 'exact', head: true }),
        supabase.from('bookings').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending')
      ]);

      const students = profiles?.filter(p => p.role === 'student').length || 0;
      const landlords = profiles?.filter(p => p.role === 'landlord').length || 0;

      setStats({
        totalUsers: profiles?.length || 0,
        totalStudents: students,
        totalLandlords: landlords,
        totalListings: totalListings || 0,
        totalBookings: totalBookings || 0,
        pendingVerifications: pendingVerifications || 0,
      });

      // Load analytics data
      await loadAnalyticsData();
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadAnalyticsData() {
    try {
      // Get user growth for last 30 days
      const { data: userGrowthData } = await supabase
        .rpc('get_daily_user_growth', { days: 30 }) as { data: { date: string; count: number }[] | null };

      // Get listing growth for last 30 days
      const { data: listingGrowthData } = await supabase
        .rpc('get_daily_listing_growth', { days: 30 }) as { data: { date: string; count: number }[] | null };

      // Get booking growth for last 30 days
      const { data: bookingGrowthData } = await supabase
        .rpc('get_daily_booking_growth', { days: 30 }) as { data: { date: string; count: number }[] | null };

      // Get daily activity
      const { data: dailyActivityData } = await supabase
        .rpc('get_daily_activity', { days: 30 }) as { data: { date: string; users: number; listings: number; bookings: number }[] | null };

      setAnalytics({
        userGrowth: userGrowthData || [],
        listingGrowth: listingGrowthData || [],
        bookingGrowth: bookingGrowthData || [],
        dailyActivity: dailyActivityData || [],
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  }

  async function loadConversations() {
    try {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name');

      const profileMap = new Map(
        profiles?.map(p => [p.id, `${p.first_name} ${p.last_name}`]) || []
      );

      const conversationMap = new Map<string, Conversation>();

      messages?.forEach((msg: Message) => {
        const key = [msg.sender_id, msg.recipient_id].sort().join('-');

        if (!conversationMap.has(key)) {
          const [id1, id2] = [msg.sender_id, msg.recipient_id].sort();
          conversationMap.set(key, {
            user1_id: id1,
            user2_id: id2,
            user1_name: profileMap.get(id1) || 'Utilisateur inconnu',
            user2_name: profileMap.get(id2) || 'Utilisateur inconnu',
            last_message: msg.content,
            last_message_time: msg.created_at,
            unread_count: 0,
            messages: [],
          });
        }

        const conversation = conversationMap.get(key)!;
        conversation.messages.push(msg);

        if (msg.created_at > conversation.last_message_time) {
          conversation.last_message = msg.content;
          conversation.last_message_time = msg.created_at;
        }

        if (!msg.is_read) {
          conversation.unread_count++;
        }
      });

      setConversations(Array.from(conversationMap.values()).sort(
        (a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
      ));

      if (messagingSubTab === 'alerts') {
        await loadBlockedMessages();
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  }

  async function loadBlockedMessages() {
    try {
      const { data: stats } = await supabase.rpc('get_blocked_messages_stats');
      setBlockedStats(stats ? stats[0] : null);

      const { data: blocked, error } = await supabase
        .from('blocked_messages')
        .select(`
          *,
          user:profiles!user_id(id, first_name, last_name),
          recipient:profiles!recipient_id(id, first_name, last_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const blockedWithAttempts = await Promise.all(
        (blocked || []).map(async (msg) => {
          const { data: count } = await supabase.rpc('get_user_blocked_attempts_count', {
            target_user_id: msg.user_id,
          });
          return {
            ...msg,
            user_name: `${msg.user.first_name} ${msg.user.last_name}`,
            recipient_name: `${msg.recipient.first_name} ${msg.recipient.last_name}`,
            attempts_count: count || 0,
          };
        })
      );

      setBlockedMessages(blockedWithAttempts);
    } catch (error) {
      console.error('Error loading blocked messages:', error);
    }
  }

  function handleViewBlockedDetails(message: any) {
    setSelectedBlockedMessage(message);
    setShowBlockedDetailsModal(true);
  }

  async function loadFinanceData() {
    try {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*, listings(title)');

      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select('*');

      const { data: pricingPlans } = await supabase
        .from('pricing_plans')
        .select('*')
        .eq('is_active', true);

      const confirmedBookings = bookings?.filter(b => b.status === 'confirmed') || [];
      const pendingBookings = bookings?.filter(b => b.status === 'pending') || [];
      const cancelledBookings = bookings?.filter(b => b.status === 'cancelled') || [];

      const studentBookingPlan = pricingPlans?.find(p => p.type === 'student' && p.plan_category === 'booking_fee');
      const bookingFeePrice = studentBookingPlan?.price || 500;
      const bookingRevenue = confirmedBookings.length * bookingFeePrice;

      const activeSubscriptions = subscriptions?.filter(s => s.status === 'active') || [];
      const premiumSubs = activeSubscriptions.filter(s => s.plan_type === 'premium');
      const freeSubs = activeSubscriptions.filter(s => s.plan_type === 'free');

      const landlordPremiumPlan = pricingPlans?.find(p => p.type === 'landlord' && p.plan_category === 'subscription' && p.name.toLowerCase().includes('premium'));
      const premiumPrice = landlordPremiumPlan?.price || 29;
      const mrr = premiumSubs.length * premiumPrice;
      const arr = mrr * 12;

      const totalRevenue = bookingRevenue + mrr;

      const conversionRate = bookings && bookings.length > 0
        ? (confirmedBookings.length / bookings.length) * 100
        : 0;

      const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (29 - i));
        return date.toISOString().split('T')[0];
      });

      const revenueGrowth = last30Days.map(date => {
        const dayBookings = confirmedBookings.filter(b =>
          b.created_at.startsWith(date)
        );
        const daySubs = premiumSubs.filter(s =>
          s.created_at.startsWith(date)
        );
        const bookingRev = dayBookings.length * bookingFeePrice;
        const subRev = daySubs.length * premiumPrice;
        return {
          date,
          revenue: bookingRev + subRev,
          bookings: dayBookings.length,
          subscriptions: daySubs.length
        };
      });

      setFinanceStats({
        totalRevenue,
        bookingRevenue,
        subscriptionRevenue: mrr,
        mrr,
        arr,
        totalBookings: bookings?.length || 0,
        confirmedBookings: confirmedBookings.length,
        pendingBookings: pendingBookings.length,
        cancelledBookings: cancelledBookings.length,
        conversionRate,
        freeSubscribers: freeSubs.length,
        premiumSubscribers: premiumSubs.length,
        revenueGrowth,
      });
    } catch (error) {
      console.error('Error loading finance data:', error);
    }
  }

  async function loadListings() {
    try {
      const { data, error } = await supabase
        .from('listings')
        .select(`
          *,
          profiles:landlord_id (
            first_name,
            last_name,
            phone
          ),
          listing_images (
            image_url,
            display_order
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data to match the component's expected format
      const transformedData = (data || []).map(listing => ({
        ...listing,
        price: listing.price_per_month,
        area: listing.apartment_area,
        is_available: listing.is_active,
        is_featured: false,
        images: listing.listing_images?.map((img: any) => img.image_url) || [],
        landlord_email: '' // Email will be fetched separately if needed
      }));

      setListings(transformedData);
    } catch (error) {
      console.error('Error loading listings:', error);
    }
  }


  async function deleteListing(listingId: string) {
    if (!confirm(t('admin.confirmDelete'))) return;

    try {
      const { error } = await supabase
        .from('listings')
        .delete()
        .eq('id', listingId);

      if (error) throw error;
      await loadListings();
      alert(t('admin.deleteSuccess'));
    } catch (error) {
      console.error('Error deleting listing:', error);
      alert(t('admin.deleteError'));
    }
  }

  useEffect(() => {
    if (!profile || profile.role !== 'admin' || activeTab !== 'listings') {
      return;
    }

    loadListings();
  }, [profile, activeTab]);

  useEffect(() => {
    if (!profile || profile.role !== 'admin' || activeTab !== 'messaging') {
      return;
    }

    loadConversations();

    const channel = supabase
      .channel('admin-messages')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, activeTab]);

  useEffect(() => {
    if (!profile || profile.role !== 'admin' || activeTab !== 'finance') {
      return;
    }

    loadFinanceData();
  }, [profile, activeTab]);

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;

    const matchesSubscription = subscriptionFilter === 'all' ||
      (subscriptionFilter === 'free' && user.subscription_plan === 'free') ||
      (subscriptionFilter === 'premium' && user.subscription_plan === 'premium') ||
      (subscriptionFilter === 'none' && !user.subscription_plan);

    return matchesSearch && matchesRole && matchesSubscription;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-rose-600" />
            <h1 className="text-3xl font-bold text-gray-900">Administration</h1>
          </div>
          <p className="text-gray-600">Tableau de bord administrateur</p>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Utilisateurs</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalUsers}</p>
                </div>
                <Users className="w-12 h-12 text-blue-500 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{t('admin.students')}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalStudents}</p>
                </div>
                <Users className="w-12 h-12 text-green-500 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{t('admin.landlords')}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalLandlords}</p>
                </div>
                <Users className="w-12 h-12 text-purple-500 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Annonces</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalListings}</p>
                </div>
                <Home className="w-12 h-12 text-rose-500 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Réservations</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalBookings}</p>
                </div>
                <Calendar className="w-12 h-12 text-orange-500 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Vérifications en attente</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stats.pendingVerifications}</p>
                </div>
                <FileText className="w-12 h-12 text-yellow-500 opacity-20" />
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2 md:flex-wrap scrollbar-hide">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 rounded-lg font-medium md:font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === 'users'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <Users className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-sm md:text-base">Utilisateurs</span>
            </button>
            <button
              onClick={() => setActiveTab('verifications')}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 rounded-lg font-medium md:font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === 'verifications'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <Shield className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-sm md:text-base">Vérifications</span>
              {stats && stats.pendingVerifications > 0 && (
                <span className="bg-yellow-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {stats.pendingVerifications}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 rounded-lg font-medium md:font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === 'analytics'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-sm md:text-base">Statistiques</span>
            </button>
            <button
              onClick={() => setActiveTab('messaging')}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 rounded-lg font-medium md:font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === 'messaging'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <MessageSquare className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-sm md:text-base">Messages</span>
            </button>
            <button
              onClick={() => setActiveTab('finance')}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 rounded-lg font-medium md:font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === 'finance'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <Euro className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-sm md:text-base">Finances</span>
            </button>
            <button
              onClick={() => setActiveTab('pricing')}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 rounded-lg font-medium md:font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === 'pricing'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <Tag className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-sm md:text-base">Tarifs</span>
            </button>
            <button
              onClick={() => setActiveTab('listings')}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 rounded-lg font-medium md:font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === 'listings'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <Home className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-sm md:text-base">Annonces</span>
            </button>
            <button
              onClick={() => window.location.href = '/?page=supportAdmin'}
              className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 rounded-lg font-medium md:font-semibold transition-all whitespace-nowrap flex-shrink-0 bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
            >
              <MessageSquare className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-sm md:text-base">Support</span>
            </button>
          </div>
        </div>

        {/* Users List */}
        {activeTab === 'users' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Tous les utilisateurs</h2>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Rechercher par email, nom, téléphone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                />
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent appearance-none bg-white"
                >
                  <option value="all">{t('admin.allRoles')}</option>
                  <option value="student">{t('admin.students')}</option>
                  <option value="landlord">{t('admin.landlords')}</option>
                  <option value="admin">Admins</option>
                </select>
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <select
                  value={subscriptionFilter}
                  onChange={(e) => setSubscriptionFilter(e.target.value)}
                  className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent appearance-none bg-white"
                >
                  <option value="all">Tous les abonnements</option>
                  <option value="free">Gratuit</option>
                  <option value="premium">Premium</option>
                  <option value="none">Sans abonnement</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Téléphone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Rôle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Abonnement
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Inscription
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.first_name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center text-white font-semibold">
                            {user.first_name.charAt(0)}{user.last_name.charAt(0)}
                          </div>
                        )}
                        <div className="ml-3">
                          <p className="text-sm font-semibold text-gray-900">
                            {user.first_name} {user.last_name}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-gray-900">{user.email}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-900">{user.phone || 'N/A'}</p>
                        {user.phone_verified && (
                          <Shield className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.role === 'admin' ? 'bg-red-100 text-red-800' :
                        user.role === 'landlord' ? 'bg-purple-100 text-purple-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {user.role === 'admin' ? 'Admin' :
                         user.role === 'landlord' ? 'Propriétaire' : 'Étudiant'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.subscription_plan ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.subscription_plan === 'premium' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.subscription_plan === 'premium' ? 'Premium' : 'Gratuit'}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-fit ${
                          user.verification_status === 'approved' ? 'bg-green-100 text-green-800' :
                          user.verification_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          user.verification_status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {user.verification_status === 'approved' ? 'Vérifié' :
                           user.verification_status === 'pending' ? 'En attente' :
                           user.verification_status === 'rejected' ? 'Rejeté' : 'Non soumis'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={async () => {
                          if (!window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement l'utilisateur ${user.first_name} ${user.last_name} ? Cette action est irréversible.`)) {
                            return;
                          }

                          try {
                            const { data: { session } } = await supabase.auth.getSession();

                            if (!session) {
                              alert('Session expirée. Veuillez vous reconnecter.');
                              return;
                            }

                            const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`;
                            const response = await fetch(apiUrl, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${session.access_token}`,
                              },
                              body: JSON.stringify({
                                userId: user.id,
                              }),
                            });

                            const result = await response.json();

                            if (!response.ok || !result.success) {
                              throw new Error(result.error || 'Erreur lors de la suppression');
                            }

                            alert('Utilisateur supprimé avec succès');
                            await loadAdminData();
                          } catch (error) {
                            console.error('Error deleting user:', error);
                            alert(error.message || 'Erreur lors de la suppression de l\'utilisateur');
                          }
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium transition-colors"
                        title="Supprimer l'utilisateur"
                      >
                        <Trash2 className="w-4 h-4" />
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">Aucun utilisateur trouvé</p>
            </div>
          )}
        </div>
        )}

        {/* Verifications Tab */}
        {activeTab === 'verifications' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* List of pending verifications */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Comptes en attente de vérification</h2>
                <p className="text-sm text-gray-500 mt-1">{pendingVerifications.length} compte(s) à vérifier</p>
              </div>

              <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                {pendingVerifications.length === 0 ? (
                  <div className="p-12 text-center">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <p className="text-gray-500">Aucune vérification en attente</p>
                  </div>
                ) : (
                  pendingVerifications.map((user) => (
                    <button
                      key={user.id}
                      onClick={async () => {
                        setSelectedUser(user);
                        if (user.verification_document_url) {
                          setVerificationDocument(user.verification_document_url);
                        }
                      }}
                      className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                        selectedUser?.id === user.id ? 'bg-rose-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt={user.first_name}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center text-white font-semibold">
                              {user.first_name.charAt(0)}{user.last_name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-gray-900">
                              {user.first_name} {user.last_name}
                            </p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              <Clock className="w-3 h-3 inline mr-1" />
                              Soumis le {user.verification_submitted_at ? new Date(user.verification_submitted_at).toLocaleDateString('fr-FR') : 'N/A'}
                            </p>
                          </div>
                        </div>
                        <Eye className="w-5 h-5 text-gray-400" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Verification details */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              {selectedUser ? (
                <>
                  <div className="p-6 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900">Vérifier l'identité</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedUser.first_name} {selectedUser.last_name}
                    </p>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* User info */}
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-semibold text-gray-600">Email</label>
                        <p className="text-gray-900">{selectedUser.email}</p>
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-gray-600">Téléphone</label>
                        <p className="text-gray-900">{selectedUser.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-semibold text-gray-600">Rôle</label>
                        <p className="text-gray-900">
                          {selectedUser.role === 'student' ? 'Étudiant' : 'Propriétaire'}
                        </p>
                      </div>
                    </div>

                    {/* Document preview */}
                    {verificationDocument && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-semibold text-gray-600">
                            Document d'identité
                          </label>
                          <a
                            href={verificationDocument}
                            download={`verification_${selectedUser.first_name}_${selectedUser.last_name}.jpg`}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Télécharger
                          </a>
                        </div>
                        <div className="relative group">
                          <img
                            src={verificationDocument}
                            alt="Document de vérification"
                            className="w-full rounded-lg border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow"
                            onClick={() => window.open(verificationDocument, '_blank')}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all rounded-lg flex items-center justify-center">
                            <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 text-center">
                          Cliquez sur l'image pour l'agrandir
                        </p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={async () => {
                          try {
                            // Update profile status
                            const { data: updateData, error: updateError } = await supabase
                              .from('profiles')
                              .update({
                                verification_status: 'approved',
                                is_verified: true,
                                verification_reviewed_at: new Date().toISOString(),
                              })
                              .eq('id', selectedUser.id)
                              .select();

                            if (updateError) {
                              console.error('Error updating profile:', updateError);
                              throw updateError;
                            }

                            console.log('Profile updated successfully:', updateData);

                            // Create notification
                            const { error: notifError } = await supabase
                              .from('notifications')
                              .insert({
                                user_id: selectedUser.id,
                                type: 'booking_confirmed',
                                title: 'Compte vérifié ✓',
                                message: 'Votre compte a été vérifié avec succès ! Vous pouvez maintenant profiter de tous les avantages de la plateforme.',
                                link: '/profile',
                              });

                            if (notifError) console.error('Error creating notification:', notifError);

                            // Send email
                            try {
                              const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-approval-email`;
                              await fetch(apiUrl, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  to: selectedUser.email,
                                  firstName: selectedUser.first_name,
                                  lastName: selectedUser.last_name,
                                  isApproved: true,
                                }),
                              });
                            } catch (emailError) {
                              console.error('Error sending email:', emailError);
                            }

                            alert('Compte approuvé avec succès! L\'utilisateur a reçu un email et une notification.');
                            await loadAdminData();
                            setSelectedUser(null);
                            setPendingVerifications(prev => prev.filter(u => u.id !== selectedUser.id));
                          } catch (error) {
                            console.error('Error approving verification:', error);
                            alert('Erreur lors de l\'approbation');
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                      >
                        <CheckCircle className="w-5 h-5" />
                        Approuver
                      </button>
                      <button
                        onClick={async () => {
                          const reason = prompt('Raison du rejet (optionnel):');
                          try {
                            // Update profile status
                            const { data: updateData, error: updateError } = await supabase
                              .from('profiles')
                              .update({
                                verification_status: 'rejected',
                                is_verified: false,
                                verification_reviewed_at: new Date().toISOString(),
                                verification_rejection_reason: reason || null,
                              })
                              .eq('id', selectedUser.id)
                              .select();

                            if (updateError) {
                              console.error('Error updating profile:', updateError);
                              throw updateError;
                            }

                            console.log('Profile updated successfully:', updateData);

                            // Create notification
                            const { error: notifError } = await supabase
                              .from('notifications')
                              .insert({
                                user_id: selectedUser.id,
                                type: 'booking_cancelled',
                                title: 'Demande de vérification',
                                message: reason
                                  ? `Votre demande de vérification n'a pas pu être approuvée. Raison: ${reason}`
                                  : 'Votre demande de vérification n\'a pas pu être approuvée. Veuillez soumettre un nouveau document.',
                                link: '/profile',
                              });

                            if (notifError) console.error('Error creating notification:', notifError);

                            // Send email
                            try {
                              const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-approval-email`;
                              await fetch(apiUrl, {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  to: selectedUser.email,
                                  firstName: selectedUser.first_name,
                                  lastName: selectedUser.last_name,
                                  isApproved: false,
                                  rejectionReason: reason,
                                }),
                              });
                            } catch (emailError) {
                              console.error('Error sending email:', emailError);
                            }

                            alert('Compte rejeté. L\'utilisateur a reçu un email et une notification.');
                            await loadAdminData();
                            setSelectedUser(null);
                            setPendingVerifications(prev => prev.filter(u => u.id !== selectedUser.id));
                          } catch (error) {
                            console.error('Error rejecting verification:', error);
                            alert('Erreur lors du rejet');
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
                      >
                        <XCircle className="w-5 h-5" />
                        Rejeter
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-12 text-center">
                  <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">Sélectionnez un compte à vérifier</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && analytics && (
          <div className="space-y-6">
            {/* Growth Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* User Growth Chart */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Croissance Utilisateurs</h3>
                  <Users className="w-6 h-6 text-blue-500" />
                </div>
                <div className="space-y-2">
                  {analytics.userGrowth.slice(0, 7).map((item, index) => {
                    const maxCount = Math.max(...analytics.userGrowth.map(d => d.count));
                    const percentage = (item.count / maxCount) * 100;
                    return (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                          <span className="font-semibold text-gray-900">{item.count}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Listing Growth Chart */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Croissance Annonces</h3>
                  <Home className="w-6 h-6 text-rose-500" />
                </div>
                <div className="space-y-2">
                  {analytics.listingGrowth.slice(0, 7).map((item, index) => {
                    const maxCount = Math.max(...analytics.listingGrowth.map(d => d.count));
                    const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                    return (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                          <span className="font-semibold text-gray-900">{item.count}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-rose-500 h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Booking Growth Chart */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Croissance Réservations</h3>
                  <Calendar className="w-6 h-6 text-green-500" />
                </div>
                <div className="space-y-2">
                  {analytics.bookingGrowth.slice(0, 7).map((item, index) => {
                    const maxCount = Math.max(...analytics.bookingGrowth.map(d => d.count));
                    const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                    return (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                          <span className="font-semibold text-gray-900">{item.count}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Daily Activity Overview */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <BarChart3 className="w-6 h-6 text-rose-600" />
                <h3 className="text-xl font-bold text-gray-900">Activité Quotidienne (30 derniers jours)</h3>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[800px] space-y-3">
                  {analytics.dailyActivity.slice(0, 10).map((activity, index) => {
                    const total = activity.users + activity.listings + activity.bookings;
                    const userPercentage = total > 0 ? (activity.users / total) * 100 : 0;
                    const listingPercentage = total > 0 ? (activity.listings / total) * 100 : 0;
                    const bookingPercentage = total > 0 ? (activity.bookings / total) * 100 : 0;

                    return (
                      <div key={index}>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-medium text-gray-700">
                            {new Date(activity.date).toLocaleDateString('fr-FR', {
                              weekday: 'long',
                              day: '2-digit',
                              month: 'long'
                            })}
                          </span>
                          <div className="flex gap-4">
                            <span className="text-blue-600">
                              <Users className="w-4 h-4 inline mr-1" />
                              {activity.users}
                            </span>
                            <span className="text-rose-600">
                              <Home className="w-4 h-4 inline mr-1" />
                              {activity.listings}
                            </span>
                            <span className="text-green-600">
                              <Calendar className="w-4 h-4 inline mr-1" />
                              {activity.bookings}
                            </span>
                          </div>
                        </div>
                        <div className="flex h-6 rounded-lg overflow-hidden">
                          {userPercentage > 0 && (
                            <div
                              className="bg-blue-500 flex items-center justify-center text-white text-xs font-semibold"
                              style={{ width: `${userPercentage}%` }}
                            >
                              {userPercentage > 10 && `${Math.round(userPercentage)}%`}
                            </div>
                          )}
                          {listingPercentage > 0 && (
                            <div
                              className="bg-rose-500 flex items-center justify-center text-white text-xs font-semibold"
                              style={{ width: `${listingPercentage}%` }}
                            >
                              {listingPercentage > 10 && `${Math.round(listingPercentage)}%`}
                            </div>
                          )}
                          {bookingPercentage > 0 && (
                            <div
                              className="bg-green-500 flex items-center justify-center text-white text-xs font-semibold"
                              style={{ width: `${bookingPercentage}%` }}
                            >
                              {bookingPercentage > 10 && `${Math.round(bookingPercentage)}%`}
                            </div>
                          )}
                          {total === 0 && (
                            <div className="w-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">
                              Aucune activité
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  <span className="text-sm text-gray-600">Nouveaux utilisateurs</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-rose-500 rounded"></div>
                  <span className="text-sm text-gray-600">Nouvelles annonces</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span className="text-sm text-gray-600">Nouvelles réservations</span>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-blue-900">Taux de croissance</h4>
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-3xl font-bold text-blue-900 mb-1">
                  {analytics.userGrowth.length > 0 ? '+' : ''}
                  {analytics.userGrowth.reduce((sum, item) => sum + item.count, 0)}
                </p>
                <p className="text-sm text-blue-700">Nouveaux utilisateurs (30j)</p>
              </div>

              <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-xl p-6 border border-rose-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-rose-900">Annonces actives</h4>
                  <Home className="w-5 h-5 text-rose-600" />
                </div>
                <p className="text-3xl font-bold text-rose-900 mb-1">
                  {analytics.listingGrowth.reduce((sum, item) => sum + item.count, 0)}
                </p>
                <p className="text-sm text-rose-700">Créées sur 30 jours</p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-green-900">Engagement</h4>
                  <Calendar className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-3xl font-bold text-green-900 mb-1">
                  {analytics.bookingGrowth.reduce((sum, item) => sum + item.count, 0)}
                </p>
                <p className="text-sm text-green-700">Réservations (30j)</p>
              </div>
            </div>
          </div>
        )}

        {/* Messaging Tab */}
        {activeTab === 'messaging' && (
          <div className="space-y-6">
            {/* Sub-tabs */}
            <div className="flex gap-2 bg-white p-2 rounded-lg border border-gray-200">
              <button
                onClick={() => setMessagingSubTab('conversations')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                  messagingSubTab === 'conversations'
                    ? 'bg-rose-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                {t('admin.alerts.conversations')}
              </button>
              <button
                onClick={() => {
                  setMessagingSubTab('alerts');
                  loadBlockedMessages();
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition relative ${
                  messagingSubTab === 'alerts'
                    ? 'bg-rose-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                {t('admin.alerts.alertsTab')}
                {blockedStats && blockedStats.total_last_7_days > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {blockedStats.total_last_7_days}
                  </span>
                )}
              </button>
            </div>

            {messagingSubTab === 'conversations' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Conversations List */}
            <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Conversations</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher une conversation..."
                    value={messageSearch}
                    onChange={(e) => setMessageSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="overflow-y-auto max-h-[600px]">
                {conversations
                  .filter(conv =>
                    conv.user1_name.toLowerCase().includes(messageSearch.toLowerCase()) ||
                    conv.user2_name.toLowerCase().includes(messageSearch.toLowerCase()) ||
                    conv.last_message.toLowerCase().includes(messageSearch.toLowerCase())
                  )
                  .map((conversation, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedConversation(conversation)}
                    className={`w-full p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left ${
                      selectedConversation === conversation ? 'bg-rose-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-rose-400 to-rose-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {conversation.user1_name.charAt(0)}{conversation.user2_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">
                            {conversation.user1_name} ↔ {conversation.user2_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(conversation.last_message_time).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                      {conversation.unread_count > 0 && (
                        <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          {conversation.unread_count}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate">
                      {conversation.last_message}
                    </p>
                  </button>
                ))}
                {conversations.length === 0 && (
                  <div className="p-8 text-center">
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">Aucune conversation</p>
                  </div>
                )}
              </div>
            </div>

            {/* Messages View */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200">
              {selectedConversation ? (
                <>
                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-rose-400 to-rose-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {selectedConversation.user1_name.charAt(0)}{selectedConversation.user2_name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {selectedConversation.user1_name} ↔ {selectedConversation.user2_name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {selectedConversation.messages.length} message(s)
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 overflow-y-auto max-h-[550px] space-y-4">
                    {selectedConversation.messages
                      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                      .map((message) => {
                        const isSender = message.sender_id === selectedConversation.user1_id;
                        const senderName = isSender ? selectedConversation.user1_name : selectedConversation.user2_name;

                        return (
                          <div key={message.id} className={`flex ${isSender ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[70%] ${isSender ? 'bg-gray-100' : 'bg-rose-500 text-white'} rounded-lg p-3`}>
                              <div className="flex items-center gap-2 mb-1">
                                <p className={`text-xs font-semibold ${isSender ? 'text-gray-700' : 'text-rose-100'}`}>
                                  {senderName}
                                </p>
                                <span className={`text-xs ${isSender ? 'text-gray-500' : 'text-rose-200'}`}>
                                  {new Date(message.created_at).toLocaleTimeString('fr-FR', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                              <p className={`text-sm ${isSender ? 'text-gray-900' : 'text-white'}`}>
                                {message.content}
                              </p>
                              {!message.is_read && (
                                <div className="flex justify-end mt-1">
                                  <span className={`text-xs ${isSender ? 'text-gray-500' : 'text-rose-200'}`}>
                                    Non lu
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full min-h-[400px]">
                  <div className="text-center">
                    <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">Sélectionnez une conversation</p>
                    <p className="text-gray-400 text-sm mt-2">Choisissez une conversation pour voir les messages</p>
                  </div>
                </div>
              )}
            </div>
          </div>
            )}

            {messagingSubTab === 'alerts' && (
              <div className="space-y-6">
                {/* Stats Cards */}
                {blockedStats && (
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-5 border border-red-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-red-900 text-sm">{t('admin.alerts.last7days')}</h4>
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                      </div>
                      <p className="text-3xl font-bold text-red-900">{blockedStats.total_last_7_days}</p>
                      <p className="text-xs text-red-700 mt-1">{t('admin.alerts.attemptsBlocked')}</p>
                    </div>

                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-5 border border-orange-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-orange-900 text-sm">{t('admin.alerts.last30days')}</h4>
                        <Ban className="w-5 h-5 text-orange-600" />
                      </div>
                      <p className="text-3xl font-bold text-orange-900">{blockedStats.total_last_30_days}</p>
                      <p className="text-xs text-orange-700 mt-1">{t('admin.alerts.totalAttempts')}</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-purple-900 text-sm">{t('admin.alerts.usersAtRisk')}</h4>
                        <Users className="w-5 h-5 text-purple-600" />
                      </div>
                      <p className="text-3xl font-bold text-purple-900">{blockedStats.users_at_risk}</p>
                      <p className="text-xs text-purple-700 mt-1">3+ {t('admin.alerts.attempts')}</p>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-blue-900 text-sm">{t('admin.alerts.mainType')}</h4>
                        <Shield className="w-5 h-5 text-blue-600" />
                      </div>
                      <p className="text-lg font-bold text-blue-900">
                        {getDetectionTypeLabel(blockedStats.most_common_type as any, 'fr')}
                      </p>
                      <p className="text-xs text-blue-700 mt-1">{t('admin.alerts.mostFrequent')}</p>
                    </div>
                  </div>
                )}

                {/* Blocked Messages Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">{t('admin.alerts.title')}</h3>
                      <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <select
                          value={alertsFilter}
                          onChange={(e) => setAlertsFilter(e.target.value)}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                        >
                          <option value="all">{t('admin.alerts.allTypes')}</option>
                          <option value="phone">{t('admin.alerts.phone')}</option>
                          <option value="email">{t('admin.alerts.email')}</option>
                          <option value="url">{t('admin.alerts.url')}</option>
                          <option value="address">{t('admin.alerts.address')}</option>
                          <option value="social_media">{t('admin.alerts.socialMedia')}</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">{t('admin.alerts.dateTime')}</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">{t('admin.alerts.user')}</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">{t('admin.alerts.recipient')}</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">{t('admin.alerts.type')}</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">{t('admin.alerts.excerpt')}</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">{t('admin.alerts.attempts')}</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">{t('admin.alerts.actions')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {blockedMessages
                          .filter((msg) => alertsFilter === 'all' || msg.detection_type === alertsFilter)
                          .map((msg) => (
                            <tr key={msg.id} className="hover:bg-gray-50 transition">
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {new Date(msg.created_at).toLocaleDateString('fr-FR', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-sm font-medium text-gray-900">{msg.user_name}</p>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">{msg.recipient_name}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-bold border ${getDetectionTypeBadgeColor(
                                    msg.detection_type as any
                                  )}`}
                                >
                                  {getDetectionTypeLabel(msg.detection_type as any, 'fr')}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                                {msg.blocked_content}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-bold ${
                                    msg.attempts_count >= 3
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  {msg.attempts_count}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => handleViewBlockedDetails(msg)}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs font-medium"
                                >
                                  <Eye className="w-3 h-3" />
                                  {t('admin.alerts.details')}
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>

                    {blockedMessages.filter((msg) => alertsFilter === 'all' || msg.detection_type === alertsFilter)
                      .length === 0 && (
                      <div className="p-12 text-center">
                        <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg">{t('admin.alerts.noAttempts')}</p>
                        <p className="text-gray-400 text-sm mt-2">
                          {t('admin.alerts.noAttemptsDesc')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Finance Tab */}
        {activeTab === 'finance' && financeStats && (
          <div className="space-y-6">
            {/* Revenue Overview Cards */}
            <div className="grid md:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-emerald-100 text-sm font-medium">Chiffre d'Affaires Total</p>
                    <p className="text-3xl font-bold mt-1">{financeStats.totalRevenue.toFixed(2)}€</p>
                  </div>
                  <Euro className="w-12 h-12 opacity-20" />
                </div>
                <div className="text-emerald-100 text-sm">
                  Réservations + Abonnements
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-blue-100 text-sm font-medium">MRR</p>
                    <p className="text-3xl font-bold mt-1">{financeStats.mrr.toFixed(2)}€</p>
                  </div>
                  <TrendingUp className="w-12 h-12 opacity-20" />
                </div>
                <div className="text-blue-100 text-sm">
                  {financeStats.premiumSubscribers} abonnés × 29€
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-purple-100 text-sm font-medium">ARR</p>
                    <p className="text-3xl font-bold mt-1">{financeStats.arr.toFixed(2)}€</p>
                  </div>
                  <BarChart3 className="w-12 h-12 opacity-20" />
                </div>
                <div className="text-purple-100 text-sm">
                  Projection annuelle
                </div>
              </div>

              <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-amber-100 text-sm font-medium">Taux de Conversion</p>
                    <p className="text-3xl font-bold mt-1">{financeStats.conversionRate.toFixed(1)}%</p>
                  </div>
                  <Percent className="w-12 h-12 opacity-20" />
                </div>
                <div className="text-amber-100 text-sm">
                  Réservations confirmées
                </div>
              </div>
            </div>

            {/* Revenue Breakdown */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-rose-600" />
                  Répartition des Revenus
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Frais de Réservation</p>
                      <p className="text-xs text-gray-500 mt-1">{financeStats.confirmedBookings} réservations × 500€</p>
                    </div>
                    <p className="text-xl font-bold text-emerald-600">{financeStats.bookingRevenue.toFixed(2)}€</p>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Abonnements Premium</p>
                      <p className="text-xs text-gray-500 mt-1">{financeStats.premiumSubscribers} propriétaires × 29€/mois</p>
                    </div>
                    <p className="text-xl font-bold text-blue-600">{financeStats.subscriptionRevenue.toFixed(2)}€</p>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Total</p>
                      <p className="text-xs text-gray-500 mt-1">Ce mois-ci</p>
                    </div>
                    <p className="text-2xl font-bold text-purple-600">{financeStats.totalRevenue.toFixed(2)}€</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-rose-600" />
                  Abonnements
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <Users className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Gratuit</p>
                        <p className="text-xs text-gray-500">0€/mois</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{financeStats.freeSubscribers}</p>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border-2 border-amber-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center">
                        <Users className="w-5 h-5 text-amber-700" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Premium</p>
                        <p className="text-xs text-amber-600 font-medium">29€/mois</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-amber-600">{financeStats.premiumSubscribers}</p>
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">Taux de conversion Premium</p>
                      <p className="text-lg font-bold text-rose-600">
                        {financeStats.freeSubscribers + financeStats.premiumSubscribers > 0
                          ? ((financeStats.premiumSubscribers / (financeStats.freeSubscribers + financeStats.premiumSubscribers)) * 100).toFixed(1)
                          : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bookings Stats */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-rose-600" />
                Statistiques des Réservations
              </h3>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{financeStats.totalBookings}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Confirmées</p>
                  <p className="text-2xl font-bold text-green-600">{financeStats.confirmedBookings}</p>
                  <p className="text-xs text-gray-500 mt-1">{(financeStats.confirmedBookings * 500).toFixed(2)}€ générés</p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">En attente</p>
                  <p className="text-2xl font-bold text-yellow-600">{financeStats.pendingBookings}</p>
                  <p className="text-xs text-gray-500 mt-1">{(financeStats.pendingBookings * 500).toFixed(2)}€ potentiels</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Annulées</p>
                  <p className="text-2xl font-bold text-red-600">{financeStats.cancelledBookings}</p>
                </div>
              </div>
            </div>

            {/* Revenue Growth Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-rose-600" />
                Évolution du Revenu (30 derniers jours)
              </h3>
              <div className="h-64 flex items-end justify-between gap-1">
                {financeStats.revenueGrowth.map((day, index) => {
                  const maxRevenue = Math.max(...financeStats.revenueGrowth.map(d => d.revenue), 1);
                  const height = (day.revenue / maxRevenue) * 100;
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center group relative">
                      <div
                        className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t hover:from-emerald-600 hover:to-emerald-500 transition-all"
                        style={{ height: `${height}%`, minHeight: day.revenue > 0 ? '4px' : '0' }}
                      />
                      <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                        {new Date(day.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                        <br />
                        {day.bookings > 0 && `${day.bookings} réservation${day.bookings > 1 ? 's' : ''} (${day.bookings * 500}€)`}
                        {day.bookings > 0 && day.subscriptions > 0 && <br />}
                        {day.subscriptions > 0 && `${day.subscriptions} abonné${day.subscriptions > 1 ? 's' : ''} (${day.subscriptions * 29}€)`}
                        {day.revenue === 0 && 'Aucun revenu'}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                <span>{financeStats.revenueGrowth[0]?.date && new Date(financeStats.revenueGrowth[0].date).toLocaleDateString('fr-FR')}</span>
                <span>{financeStats.revenueGrowth[financeStats.revenueGrowth.length - 1]?.date && new Date(financeStats.revenueGrowth[financeStats.revenueGrowth.length - 1].date).toLocaleDateString('fr-FR')}</span>
              </div>
            </div>

            {/* Projections */}
            <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl shadow-lg p-6 text-white">
              <h3 className="text-xl font-bold mb-6">Projections Financières</h3>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <p className="text-rose-100 text-sm mb-2">MRR Actuel</p>
                  <p className="text-3xl font-bold">{financeStats.mrr.toFixed(2)}€</p>
                  <p className="text-rose-100 text-xs mt-1">{financeStats.premiumSubscribers} abonnés Premium</p>
                </div>
                <div>
                  <p className="text-rose-100 text-sm mb-2">ARR Projeté</p>
                  <p className="text-3xl font-bold">{financeStats.arr.toFixed(2)}€</p>
                  <p className="text-rose-100 text-xs mt-1">Sur base annuelle</p>
                </div>
                <div>
                  <p className="text-rose-100 text-sm mb-2">Objectif MRR (100 Premium)</p>
                  <p className="text-3xl font-bold">2,900€</p>
                  <p className="text-rose-100 text-xs mt-1">+{(100 - financeStats.premiumSubscribers)} abonnés nécessaires</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pricing Tab */}
        {activeTab === 'pricing' && (
          <PricingPlansManager />
        )}

        {/* Listings Tab */}
        {activeTab === 'listings' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Gestion des Annonces</h2>
                <p className="text-gray-600 mt-1">{listings.length} annonce(s) au total</p>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Rechercher par titre, adresse, propriétaire..."
                    value={listingsSearch}
                    onChange={(e) => setListingsSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={listingsFilter}
                  onChange={(e) => setListingsFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                >
                  <option value="all">Toutes les annonces</option>
                  <option value="available">Disponibles</option>
                  <option value="unavailable">Non disponibles</option>
                  <option value="featured">Mises en avant</option>
                </select>
              </div>
            </div>

            {/* Listings Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings
                .filter(listing => {
                  const matchesSearch = listingsSearch === '' ||
                    listing.title.toLowerCase().includes(listingsSearch.toLowerCase()) ||
                    listing.address.toLowerCase().includes(listingsSearch.toLowerCase()) ||
                    listing.profiles?.first_name.toLowerCase().includes(listingsSearch.toLowerCase()) ||
                    listing.profiles?.last_name.toLowerCase().includes(listingsSearch.toLowerCase());

                  const matchesFilter =
                    listingsFilter === 'all' ||
                    (listingsFilter === 'available' && listing.is_available) ||
                    (listingsFilter === 'unavailable' && !listing.is_available) ||
                    (listingsFilter === 'featured' && listing.is_featured);

                  return matchesSearch && matchesFilter;
                })
                .map((listing) => (
                  <div key={listing.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                    {/* Image */}
                    <div className="relative h-48 bg-gray-200">
                      {listing.images && listing.images.length > 0 ? (
                        <img
                          src={listing.images[0]}
                          alt={listing.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Home className="w-12 h-12 text-gray-400" />
                        </div>
                      )}
                      {listing.is_featured && (
                        <span className="absolute top-2 right-2 px-2 py-1 bg-yellow-500 text-white text-xs font-bold rounded">
                          En vedette
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-1">{listing.title}</h3>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-start gap-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-1">{listing.address}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Users className="w-4 h-4 flex-shrink-0" />
                          <span>
                            {listing.profiles?.first_name} {listing.profiles?.last_name}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-4">
                        <span className="text-2xl font-bold text-rose-600">{listing.price}€</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          listing.is_available
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {listing.is_available ? 'Disponible' : 'Indisponible'}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="grid grid-cols-3 gap-2 mb-4 text-xs text-gray-600">
                        <div className="text-center p-2 bg-gray-50 rounded">
                          <div className="font-semibold text-gray-900">{listing.bedrooms}</div>
                          <div>Chambres</div>
                        </div>
                        <div className="text-center p-2 bg-gray-50 rounded">
                          <div className="font-semibold text-gray-900">{listing.bathrooms}</div>
                          <div>Salles de bain</div>
                        </div>
                        <div className="text-center p-2 bg-gray-50 rounded">
                          <div className="font-semibold text-gray-900">{listing.area}m²</div>
                          <div>Surface</div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => onNavigate('editListing', listing.id)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                        >
                          <Edit3 className="w-4 h-4" />
                          Modifier
                        </button>
                        <button
                          onClick={() => deleteListing(listing.id)}
                          className="flex items-center justify-center px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {listings.filter(listing => {
              const matchesSearch = listingsSearch === '' ||
                listing.title.toLowerCase().includes(listingsSearch.toLowerCase()) ||
                listing.address.toLowerCase().includes(listingsSearch.toLowerCase());
              const matchesFilter =
                listingsFilter === 'all' ||
                (listingsFilter === 'available' && listing.is_available) ||
                (listingsFilter === 'unavailable' && !listing.is_available) ||
                (listingsFilter === 'featured' && listing.is_featured);
              return matchesSearch && matchesFilter;
            }).length === 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <Home className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 text-lg">Aucune annonce trouvée</p>
              </div>
            )}
          </div>
        )}

      </div>

      <BlockedMessageDetailsModal
        isOpen={showBlockedDetailsModal}
        onClose={() => setShowBlockedDetailsModal(false)}
        blockedMessage={selectedBlockedMessage}
        userAttempts={selectedBlockedMessage?.attempts_count || 0}
      />
    </div>
  );
}
