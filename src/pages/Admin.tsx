import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Users, User, Home, Calendar, MessageSquare, FileText, Shield, Search, Filter, CheckCircle, XCircle, Eye, TrendingUp, BarChart3, Trash2, DollarSign, CreditCard, Percent, Tag, MapPin, CreditCard as Edit3, AlertTriangle, Ban, Image, BookOpen, Wallet, Megaphone, Euro, Clock } from 'lucide-react';
import PricingPlansManager from '../components/PricingPlansManager';
import AgencyComparisonManager from '../components/AgencyComparisonManager';
import BlockedMessageDetailsModal from '../components/BlockedMessageDetailsModal';
import FeatureCarouselManager from '../components/FeatureCarouselManager';
import StripeConnectAdmin from '../components/StripeConnectAdmin';
import DocumentVerificationPanel from '../components/DocumentVerificationPanel';

import PartnerOffersManager from '../components/PartnerOffersManager';
import { getDetectionTypeLabel, getDetectionTypeBadgeColor } from '../utils/messageDetection';
import BackButton from '../components/BackButton';

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
  avatar_url?: string;
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

interface ChurnedUser {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  plan_type: string;
  cancelled_at: string;
  cancellation_date: string;
  status: 'cancelled' | 'pending_cancellation';
  stripe_subscription_id: string | null;
}

interface PendingPaymentBooking {
  id: string;
  student_first_name: string;
  student_last_name: string;
  landlord_first_name: string;
  landlord_last_name: string;
  listing_title: string;
  payment_amount: number;
  payment_deadline: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
  days_remaining: number;
}

interface FinanceStats {
  totalRevenue: number;
  bookingRevenue: number;
  subscriptionRevenue: number;
  mrr: number;
  arr: number;
  totalBookings: number;
  confirmedBookings: number;
  paidBookings: number;
  pendingPaymentBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  conversionRate: number;
  paymentRate: number;
  freeSubscribers: number;
  premiumSubscribers: number;
  bookingFeePrice: number;
  premiumPrice: number;
  churnRate: number;
  churnedSubscribers: number;
  activeSubscribers: number;
  churnedUsers: ChurnedUser[];
  pendingPayments: PendingPaymentBooking[];
  revenueGrowth: { date: string; revenue: number; bookings: number; subscriptions: number }[];
  churnData: { date: string; churned: number; active: number; rate: number }[];
}

export default function Admin() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'users' | 'verifications' | 'analytics' | 'messaging' | 'finance' | 'pricing' | 'listings' | 'carousel' | 'stripe' | 'partner-offers'>('users');
  const [pendingVerifications, _setPendingVerifications] = useState<UserData[]>([]);
  const [selectedUser, _setSelectedUser] = useState<UserData | null>(null);
  const [verificationDocument, _setVerificationDocument] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  _setPendingVerifications; // Mark as used
  _setSelectedUser; // Mark as used
  _setVerificationDocument; // Mark as used
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
  const [pendingDocumentsCount, setPendingDocumentsCount] = useState(0);

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
          // Get email using the get_user_email function
          const { data: emailData } = await supabase
            .rpc('get_user_email', { user_id: profile.id });

          // Get subscription data
          const { data: subscription } = await supabase
            .from('subscriptions')
            .select('plan_type')
            .eq('user_id', profile.id)
            .maybeSingle();

          return {
            ...profile,
            email: emailData || 'N/A',
            last_sign_in_at: profile.created_at,
            subscription_plan: subscription?.plan_type || (profile.role === 'landlord' ? 'free' : null),
          };
        })
      );

      setUsers(usersWithAuth);

      // Load pending verifications
      const _pendingUsers = usersWithAuth.filter(u => u.verification_status === 'pending');
      _pendingUsers;

      // Load stats
      const [
        { count: totalListings },
        { count: totalBookings },
        { count: pendingVerifications },
        { count: pendingStudentDocs },
        { count: pendingLandlordDocs }
      ] = await Promise.all([
        supabase.from('listings').select('*', { count: 'exact', head: true }),
        supabase.from('bookings').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
        supabase.from('student_documents').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('landlord_documents').select('*', { count: 'exact', head: true }).eq('status', 'pending')
      ]);

      const students = profiles?.filter(p => p.role === 'student').length || 0;
      const landlords = profiles?.filter(p => p.role === 'landlord').length || 0;
      const totalPendingDocs = (pendingStudentDocs || 0) + (pendingLandlordDocs || 0);

      setPendingDocumentsCount(totalPendingDocs);

      setStats({
        totalUsers: profiles?.length || 0,
        totalStudents: students,
        totalLandlords: landlords,
        totalListings: totalListings || 0,
        totalBookings: totalBookings || 0,
        pendingVerifications: totalPendingDocs,
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
        .select(`
          *,
          listings(title, landlord_id),
          student:student_id(first_name, last_name)
        `);

      const { data: subscriptions } = await supabase
        .from('subscriptions')
        .select(`
          *,
          profiles:user_id (
            first_name,
            last_name
          )
        `);

      const [{ data: pricingPlans }, { data: platformSettings }] = await Promise.all([
        supabase
          .from('pricing_plans')
          .select('*')
          .eq('is_active', true),
        supabase
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', 'platform_fee_amount')
          .maybeSingle()
      ]);

      const confirmedBookings = bookings?.filter(b => b.status === 'confirmed') || [];
      const paidBookings = confirmedBookings.filter(b => b.payment_status === 'paid');
      const pendingPaymentBookings = confirmedBookings.filter(b => b.payment_status === 'pending');
      const pendingBookings = bookings?.filter(b => b.status === 'pending') || [];
      const cancelledBookings = bookings?.filter(b => b.status === 'cancelled') || [];

      const bookingFeePrice = platformSettings?.setting_value ? parseFloat(platformSettings.setting_value) : 390;
      const bookingRevenue = paidBookings.length * bookingFeePrice;

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

      const paymentRate = confirmedBookings.length > 0
        ? (paidBookings.length / confirmedBookings.length) * 100
        : 0;

      const landlordIds = Array.from(new Set(pendingPaymentBookings.map(b => (b as any).listings?.landlord_id).filter(Boolean)));
      const { data: landlords } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', landlordIds.length > 0 ? landlordIds : ['00000000-0000-0000-0000-000000000000']);

      const landlordMap = new Map(landlords?.map(l => [l.id, l]) || []);

      const now = new Date();
      const pendingPayments: PendingPaymentBooking[] = pendingPaymentBookings.map(b => {
        const landlord = landlordMap.get((b as any).listings?.landlord_id);
        const deadline = b.payment_deadline ? new Date(b.payment_deadline) : null;
        const daysRemaining = deadline
          ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : -1;

        return {
          id: b.id,
          student_first_name: (b as any).student?.first_name || 'N/A',
          student_last_name: (b as any).student?.last_name || 'N/A',
          landlord_first_name: landlord?.first_name || 'N/A',
          landlord_last_name: landlord?.last_name || 'N/A',
          listing_title: (b as any).listings?.title || 'N/A',
          payment_amount: parseFloat(b.payment_amount || '0'),
          payment_deadline: b.payment_deadline,
          start_date: b.start_date,
          end_date: b.end_date,
          created_at: b.created_at,
          days_remaining: daysRemaining
        };
      }).sort((a, b) => {
        if (a.days_remaining < 0 && b.days_remaining >= 0) return 1;
        if (b.days_remaining < 0 && a.days_remaining >= 0) return -1;
        return a.days_remaining - b.days_remaining;
      });

      const cancelledSubs = subscriptions?.filter(s => s.status === 'cancelled') || [];
      const pendingCancellations = activeSubscriptions.filter(s => s.cancel_at_period_end === true);

      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const churnedThisMonth = cancelledSubs.filter(s => {
        const cancelledDate = new Date(s.updated_at);
        return cancelledDate >= thirtyDaysAgo;
      }).length;

      const pendingChurnThisMonth = pendingCancellations.filter(s => {
        const requestDate = new Date(s.updated_at);
        return requestDate >= thirtyDaysAgo;
      }).length;

      const totalChurnedThisMonth = churnedThisMonth + pendingChurnThisMonth;
      const totalActiveAtStart = premiumSubs.length + churnedThisMonth;
      const churnRate = totalActiveAtStart > 0 ? (totalChurnedThisMonth / totalActiveAtStart) * 100 : 0;

      const churnedUsers: ChurnedUser[] = [
        ...cancelledSubs.map(s => ({
          id: s.id,
          user_id: s.user_id,
          first_name: (s as any).profiles?.first_name || 'N/A',
          last_name: (s as any).profiles?.last_name || 'N/A',
          plan_type: s.plan_type,
          cancelled_at: s.updated_at,
          cancellation_date: s.updated_at,
          status: 'cancelled' as const,
          stripe_subscription_id: s.stripe_subscription_id
        })),
        ...pendingCancellations.map(s => ({
          id: s.id,
          user_id: s.user_id,
          first_name: (s as any).profiles?.first_name || 'N/A',
          last_name: (s as any).profiles?.last_name || 'N/A',
          plan_type: s.plan_type,
          cancelled_at: s.updated_at,
          cancellation_date: s.current_period_end || s.updated_at,
          status: 'pending_cancellation' as const,
          stripe_subscription_id: s.stripe_subscription_id
        }))
      ].sort((a, b) => new Date(b.cancelled_at).getTime() - new Date(a.cancelled_at).getTime());

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

      const churnData = last30Days.map(date => {
        const dayCancelled = cancelledSubs.filter(s =>
          s.updated_at.startsWith(date)
        ).length;
        const dayPendingCancel = pendingCancellations.filter(s =>
          s.updated_at.startsWith(date)
        ).length;
        const dayChurned = dayCancelled + dayPendingCancel;
        const dayActive = activeSubscriptions.filter(s =>
          new Date(s.created_at) <= new Date(date) &&
          (s.status === 'active' || new Date(s.updated_at) > new Date(date))
        ).length;
        const dayRate = dayActive > 0 ? (dayChurned / dayActive) * 100 : 0;
        return {
          date,
          churned: dayChurned,
          active: dayActive,
          rate: dayRate
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
        paidBookings: paidBookings.length,
        pendingPaymentBookings: pendingPaymentBookings.length,
        pendingBookings: pendingBookings.length,
        cancelledBookings: cancelledBookings.length,
        conversionRate,
        paymentRate,
        freeSubscribers: freeSubs.length,
        premiumSubscribers: premiumSubs.length,
        bookingFeePrice,
        premiumPrice,
        churnRate,
        churnedSubscribers: totalChurnedThisMonth,
        activeSubscribers: premiumSubs.length,
        churnedUsers,
        pendingPayments,
        revenueGrowth,
        churnData,
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
        .order('created_at', { ascending: false })
        .order('display_order', { ascending: true, referencedTable: 'listing_images' });

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
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <BackButton />
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-rose-600" />
            <h1 className="text-3xl font-bold text-gray-900">{t('admin.title')}</h1>
          </div>
          <p className="text-gray-600">{t('admin.subtitle')}</p>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{t('admin.totalUsers')}</p>
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
                  <p className="text-sm text-gray-600">{t('admin.listings')}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalListings}</p>
                </div>
                <Home className="w-12 h-12 text-rose-500 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{t('admin.bookings')}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalBookings}</p>
                </div>
                <Calendar className="w-12 h-12 text-orange-500 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{t('admin.pendingVerifications')}</p>
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
              <span className="text-sm md:text-base">{t('admin.tabs.users')}</span>
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
              <span className="text-sm md:text-base">{t('admin.tabs.verifications')}</span>
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
              <span className="text-sm md:text-base">{t('admin.tabs.analytics')}</span>
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
              <span className="text-sm md:text-base">{t('admin.tabs.messaging')}</span>
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
              <span className="text-sm md:text-base">{t('admin.tabs.finance')}</span>
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
              <span className="text-sm md:text-base">{t('admin.tabs.pricing')}</span>
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
              <span className="text-sm md:text-base">{t('admin.tabs.listings')}</span>
            </button>
            <button
              onClick={() => setActiveTab('carousel')}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 rounded-lg font-medium md:font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === 'carousel'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <Image className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-sm md:text-base">{t('admin.tabs.carousel')}</span>
            </button>
            <button
              onClick={() => setActiveTab('partner-offers')}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 rounded-lg font-medium md:font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === 'partner-offers'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <Megaphone className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-sm md:text-base">{t('admin.tabs.partnerOffers')}</span>
            </button>
            <button
              onClick={() => setActiveTab('stripe')}
              className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 rounded-lg font-medium md:font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === 'stripe'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <Wallet className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-sm md:text-base">{t('admin.tabs.stripe')}</span>
            </button>
            <button
              onClick={() => navigate('/admin/support')}
              className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 rounded-lg font-medium md:font-semibold transition-all whitespace-nowrap flex-shrink-0 bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
            >
              <MessageSquare className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-sm md:text-base">{t('support.title')}</span>
            </button>
            <button
              onClick={() => navigate('/admin/blog')}
              className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 rounded-lg font-medium md:font-semibold transition-all whitespace-nowrap flex-shrink-0 bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
            >
              <BookOpen className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-sm md:text-base">Blog</span>
            </button>
          </div>
        </div>

        {/* Users List */}
        {activeTab === 'users' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{t('admin.tabs.users')}</h2>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder={t('admin.search.placeholder')}
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
                  <option value="all">{t('admin.filter.allSubscriptions')}</option>
                  <option value="free">{t('admin.free')}</option>
                  <option value="premium">{t('admin.premium')}</option>
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
                    {t('admin.user')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {t('admin.email')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {t('admin.phone')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {t('admin.role')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {t('admin.subscription')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {t('admin.status')}
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
                         user.role === 'landlord' ? t('admin.landlords') : t('admin.students')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.subscription_plan ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.subscription_plan === 'premium' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.subscription_plan === 'premium' ? t('admin.premium') : t('admin.free')}
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
                          {user.verification_status === 'approved' ? t('admin.verified') :
                           user.verification_status === 'pending' ? t('auth.pendingVerification') :
                           user.verification_status === 'rejected' ? 'Rejeté' : t('admin.notVerified')}
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
                            alert(error instanceof Error ? error.message : 'Erreur lors de la suppression de l\'utilisateur');
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
          <DocumentVerificationPanel onPendingCountChange={(count) => {
            if (stats) {
              setStats(prev => prev ? { ...prev, pendingVerifications: count } : prev);
            }
          }} />
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
                  {financeStats.premiumSubscribers} abonnés × {financeStats.premiumPrice}€
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
                      <p className="text-sm font-medium text-gray-600">Frais de Réservation Étudiants</p>
                      <p className="text-xs text-gray-500 mt-1">{financeStats.confirmedBookings} réservations × {financeStats.bookingFeePrice}€</p>
                    </div>
                    <p className="text-xl font-bold text-emerald-600">{financeStats.bookingRevenue.toFixed(2)}€</p>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Abonnements Premium</p>
                      <p className="text-xs text-gray-500 mt-1">{financeStats.premiumSubscribers} propriétaires × {financeStats.premiumPrice}€/mois</p>
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
                        <p className="text-xs text-amber-600 font-medium">{financeStats.premiumPrice}€/mois</p>
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
              <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{financeStats.totalBookings}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200">
                  <p className="text-sm text-gray-600 mb-1">Confirmées</p>
                  <p className="text-2xl font-bold text-green-600">{financeStats.confirmedBookings}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                  <p className="text-sm text-gray-600 mb-1">Payées</p>
                  <p className="text-2xl font-bold text-blue-600">{financeStats.paidBookings}</p>
                  <p className="text-xs text-gray-500 mt-1">{(financeStats.paidBookings * financeStats.bookingFeePrice).toFixed(2)}€ générés</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg border-2 border-orange-200">
                  <p className="text-sm text-gray-600 mb-1">En attente paiement</p>
                  <p className="text-2xl font-bold text-orange-600">{financeStats.pendingPaymentBookings}</p>
                  <p className="text-xs text-gray-500 mt-1">{(financeStats.pendingPaymentBookings * financeStats.bookingFeePrice).toFixed(2)}€ attendus</p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">En attente validation</p>
                  <p className="text-2xl font-bold text-yellow-600">{financeStats.pendingBookings}</p>
                  <p className="text-xs text-gray-500 mt-1">{(financeStats.pendingBookings * financeStats.bookingFeePrice).toFixed(2)}€ potentiels</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Annulées</p>
                  <p className="text-2xl font-bold text-red-600">{financeStats.cancelledBookings}</p>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Taux de Conversion (Confirmées / Total)</p>
                    <p className="text-2xl font-bold text-rose-600">{financeStats.conversionRate.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Taux de Paiement (Payées / Confirmées)</p>
                    <p className="text-2xl font-bold text-blue-600">{financeStats.paymentRate.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pending Payments Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-orange-600" />
                Réservations en Attente de Paiement
              </h3>

              {financeStats.pendingPayments.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">Aucun paiement en attente</p>
                  <p className="text-gray-400 text-sm mt-2">Toutes les réservations confirmées ont été payées</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Étudiant
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Propriétaire
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Logement
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Montant
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date limite
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Délai restant
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Période
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {financeStats.pendingPayments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <User className="h-5 w-5 text-blue-600" />
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {payment.student_first_name} {payment.student_last_name}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {payment.landlord_first_name} {payment.landlord_last_name}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 max-w-xs truncate">
                              {payment.listing_title}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900">
                              {payment.payment_amount.toFixed(2)}€
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {payment.payment_deadline ? (
                              new Date(payment.payment_deadline).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            ) : (
                              <span className="text-gray-400">Non définie</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {payment.days_remaining < 0 ? (
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                Pas de limite
                              </span>
                            ) : payment.days_remaining === 0 ? (
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                Aujourd'hui !
                              </span>
                            ) : payment.days_remaining <= 2 ? (
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                {payment.days_remaining} jour{payment.days_remaining > 1 ? 's' : ''}
                              </span>
                            ) : payment.days_remaining <= 5 ? (
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                                {payment.days_remaining} jours
                              </span>
                            ) : (
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                {payment.days_remaining} jours
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div>
                              {new Date(payment.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                              {' → '}
                              {new Date(payment.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Revenue Growth Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-rose-600" />
                Évolution du Revenu (30 derniers jours)
              </h3>

              <div className="mb-4 flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-gray-600">Revenu Total</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-gray-600">Réservations</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <span className="text-gray-600">Abonnements</span>
                </div>
              </div>

              <div className="relative h-64">
                <svg className="w-full h-full" viewBox="0 0 800 256" preserveAspectRatio="none">
                  {(() => {
                    const maxRevenue = Math.max(...financeStats.revenueGrowth.map(d => d.revenue), 1);
                    const maxBookingRevenue = Math.max(...financeStats.revenueGrowth.map(d => d.bookings * financeStats.bookingFeePrice), 1);
                    const maxSubRevenue = Math.max(...financeStats.revenueGrowth.map(d => d.subscriptions * financeStats.premiumPrice), 1);
                    const points = financeStats.revenueGrowth.length;
                    const stepX = 800 / (points - 1 || 1);

                    const totalRevenuePoints = financeStats.revenueGrowth.map((d, i) => ({
                      x: i * stepX,
                      y: 256 - (d.revenue / maxRevenue * 220)
                    }));

                    const bookingRevenuePoints = financeStats.revenueGrowth.map((d, i) => ({
                      x: i * stepX,
                      y: 256 - ((d.bookings * financeStats.bookingFeePrice) / maxRevenue * 220)
                    }));

                    const subRevenuePoints = financeStats.revenueGrowth.map((d, i) => ({
                      x: i * stepX,
                      y: 256 - ((d.subscriptions * financeStats.premiumPrice) / maxRevenue * 220)
                    }));

                    const createPath = (points: {x: number, y: number}[]) => {
                      return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                    };

                    return (
                      <>
                        <defs>
                          <linearGradient id="totalGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                          </linearGradient>
                        </defs>

                        {/* Grid lines */}
                        {[0, 1, 2, 3, 4].map((i) => (
                          <line
                            key={i}
                            x1="0"
                            y1={36 + i * 55}
                            x2="800"
                            y2={36 + i * 55}
                            stroke="#e5e7eb"
                            strokeWidth="1"
                            strokeDasharray="5,5"
                          />
                        ))}

                        {/* Area fill for total revenue */}
                        <path
                          d={`${createPath(totalRevenuePoints)} L ${totalRevenuePoints[totalRevenuePoints.length - 1].x} 256 L 0 256 Z`}
                          fill="url(#totalGradient)"
                        />

                        {/* Subscriptions line */}
                        <path
                          d={createPath(subRevenuePoints)}
                          fill="none"
                          stroke="#a855f7"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Bookings line */}
                        <path
                          d={createPath(bookingRevenuePoints)}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Total revenue line */}
                        <path
                          d={createPath(totalRevenuePoints)}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Data points */}
                        {totalRevenuePoints.map((point, i) => (
                          <g key={i}>
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r="4"
                              fill="#10b981"
                              stroke="white"
                              strokeWidth="2"
                              className="hover:r-6 transition-all cursor-pointer"
                            />
                            <title>
                              {new Date(financeStats.revenueGrowth[i].date).toLocaleDateString('fr-FR')}
                              {'\n'}Revenu: {financeStats.revenueGrowth[i].revenue.toFixed(2)}€
                              {'\n'}Réservations: {financeStats.revenueGrowth[i].bookings}
                              {'\n'}Abonnements: {financeStats.revenueGrowth[i].subscriptions}
                            </title>
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </svg>

                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-500 pr-2" style={{ width: '60px' }}>
                  {[4, 3, 2, 1, 0].map((i) => {
                    const maxRevenue = Math.max(...financeStats.revenueGrowth.map(d => d.revenue), 1);
                    const value = (maxRevenue / 4) * i;
                    return <span key={i}>{value.toFixed(0)}€</span>;
                  })}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                <span>{financeStats.revenueGrowth[0]?.date && new Date(financeStats.revenueGrowth[0].date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                <span>{financeStats.revenueGrowth[financeStats.revenueGrowth.length - 1]?.date && new Date(financeStats.revenueGrowth[financeStats.revenueGrowth.length - 1].date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
              </div>
            </div>

            {/* Churn Analysis */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-rose-600" />
                Analyse du Churn (Taux d'Attrition)
              </h3>

              <div className="grid md:grid-cols-3 gap-6 mb-6">
                <div className="p-4 bg-red-50 rounded-lg border-2 border-red-200">
                  <p className="text-sm text-gray-600 mb-1">Taux de Churn</p>
                  <p className="text-3xl font-bold text-red-600">{financeStats.churnRate.toFixed(1)}%</p>
                  <p className="text-xs text-gray-500 mt-1">30 derniers jours</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Désabonnements</p>
                  <p className="text-3xl font-bold text-orange-600">{financeStats.churnedSubscribers}</p>
                  <p className="text-xs text-gray-500 mt-1">Ce mois-ci</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Abonnés Actifs</p>
                  <p className="text-3xl font-bold text-green-600">{financeStats.activeSubscribers}</p>
                  <p className="text-xs text-gray-500 mt-1">Premium actuellement</p>
                </div>
              </div>

              <div className="mb-4 flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-gray-600">Désabonnements</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-gray-600">Abonnés Actifs</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-gray-600">Taux de Churn (%)</span>
                </div>
              </div>

              <div className="relative h-64">
                <svg className="w-full h-full" viewBox="0 0 800 256" preserveAspectRatio="none">
                  {(() => {
                    const maxChurned = Math.max(...financeStats.churnData.map(d => d.churned), 1);
                    const maxActive = Math.max(...financeStats.churnData.map(d => d.active), 1);
                    const maxRate = Math.max(...financeStats.churnData.map(d => d.rate), 1);
                    const points = financeStats.churnData.length;
                    const stepX = 800 / (points - 1 || 1);

                    const churnedPoints = financeStats.churnData.map((d, i) => ({
                      x: i * stepX,
                      y: 256 - (d.churned / maxChurned * 220)
                    }));

                    const activePoints = financeStats.churnData.map((d, i) => ({
                      x: i * stepX,
                      y: 256 - (d.active / maxActive * 220)
                    }));

                    const ratePoints = financeStats.churnData.map((d, i) => ({
                      x: i * stepX,
                      y: 256 - (d.rate / (maxRate || 100) * 220)
                    }));

                    const createPath = (points: {x: number, y: number}[]) => {
                      return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                    };

                    return (
                      <>
                        <defs>
                          <linearGradient id="churnGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                          </linearGradient>
                        </defs>

                        {/* Grid lines */}
                        {[0, 1, 2, 3, 4].map((i) => (
                          <line
                            key={i}
                            x1="0"
                            y1={36 + i * 55}
                            x2="800"
                            y2={36 + i * 55}
                            stroke="#e5e7eb"
                            strokeWidth="1"
                            strokeDasharray="5,5"
                          />
                        ))}

                        {/* Area fill for churned */}
                        <path
                          d={`${createPath(churnedPoints)} L ${churnedPoints[churnedPoints.length - 1].x} 256 L 0 256 Z`}
                          fill="url(#churnGradient)"
                        />

                        {/* Active subscribers line */}
                        <path
                          d={createPath(activePoints)}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Churn rate line */}
                        <path
                          d={createPath(ratePoints)}
                          fill="none"
                          stroke="#f97316"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeDasharray="5,5"
                        />

                        {/* Churned line */}
                        <path
                          d={createPath(churnedPoints)}
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Data points for churned */}
                        {churnedPoints.map((point, i) => (
                          <g key={i}>
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r="4"
                              fill="#ef4444"
                              stroke="white"
                              strokeWidth="2"
                              className="hover:r-6 transition-all cursor-pointer"
                            />
                            <title>
                              {new Date(financeStats.churnData[i].date).toLocaleDateString('fr-FR')}
                              {'\n'}Désabonnements: {financeStats.churnData[i].churned}
                              {'\n'}Actifs: {financeStats.churnData[i].active}
                              {'\n'}Taux: {financeStats.churnData[i].rate.toFixed(1)}%
                            </title>
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </svg>

                {/* Y-axis labels (left) */}
                <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-500 pr-2" style={{ width: '60px' }}>
                  {[4, 3, 2, 1, 0].map((i) => {
                    const maxChurned = Math.max(...financeStats.churnData.map(d => d.churned), 1);
                    const value = (maxChurned / 4) * i;
                    return <span key={i}>{value.toFixed(0)}</span>;
                  })}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                <span>{financeStats.churnData[0]?.date && new Date(financeStats.churnData[0].date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                <span>{financeStats.churnData[financeStats.churnData.length - 1]?.date && new Date(financeStats.churnData[financeStats.churnData.length - 1].date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
              </div>
            </div>

            {/* Churn Details Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-rose-600" />
                Liste des Désabonnements
              </h3>

              {financeStats.churnedUsers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">Aucun désabonnement</p>
                  <p className="text-gray-400 text-sm mt-2">Excellent ! Tous vos abonnés Premium sont satisfaits</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Client
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Plan
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Statut
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date demande
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date effective
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          ID Stripe
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {financeStats.churnedUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <User className="h-5 w-5 text-gray-500" />
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {user.first_name} {user.last_name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {user.user_id.substring(0, 8)}...
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-100 text-amber-800">
                              {user.plan_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {user.status === 'cancelled' ? (
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                Annulé
                              </span>
                            ) : (
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                                En attente d'annulation
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(user.cancelled_at).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(user.cancellation_date).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                            {user.stripe_subscription_id ? (
                              <span className="text-xs">{user.stripe_subscription_id.substring(0, 20)}...</span>
                            ) : (
                              <span className="text-gray-400">N/A</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
                  <p className="text-3xl font-bold">{(100 * financeStats.premiumPrice).toLocaleString('fr-FR')}€</p>
                  <p className="text-rose-100 text-xs mt-1">+{(100 - financeStats.premiumSubscribers)} abonnés nécessaires</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pricing Tab */}
        {activeTab === 'pricing' && (
          <div className="space-y-8">
            <PricingPlansManager />
            <div className="border-t-4 border-gray-200 pt-8">
              <AgencyComparisonManager />
            </div>
          </div>
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
                        <span className="text-2xl font-bold text-rose-600">{listing.price_per_month}€</span>
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
                          onClick={() => navigate(`/modifier-annonce/${listing.id}`)}
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

        {/* Carousel Tab */}
        {activeTab === 'carousel' && (
          <FeatureCarouselManager />
        )}

        {/* Stripe Connect Tab */}
        {activeTab === 'stripe' && (
          <StripeConnectAdmin />
        )}

        {/* Partner Offers Tab */}
        {activeTab === 'partner-offers' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <PartnerOffersManager />
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
