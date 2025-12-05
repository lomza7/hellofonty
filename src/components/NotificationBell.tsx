import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type Notification = {
  id: string;
  type: 'message' | 'booking_request' | 'booking_confirmed' | 'booking_cancelled';
  title: string;
  message: string;
  link: string | null;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
};

export default function NotificationBell() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const previousUnreadCountRef = useRef(0);

  useEffect(() => {
    if (profile?.id) {
      loadNotifications();

      const notificationsChannel = supabase
        .channel('notifications-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${profile.id}`,
          },
          (payload) => {
            console.log('Nouvelle notification reçue:', payload);
            loadNotifications();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${profile.id}`,
          },
          (payload) => {
            console.log('Notification mise à jour:', payload);
            loadNotifications();
          }
        )
        .subscribe();

      const messagesChannel = supabase
        .channel('messages-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `recipient_id=eq.${profile.id}`,
          },
          () => {
            console.log('Nouveau message reçu');
            loadNotifications();
          }
        )
        .subscribe();

      const bookingsChannel = supabase
        .channel('bookings-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bookings',
          },
          async (payload) => {
            console.log('Changement de booking:', payload);
            if (payload.eventType === 'INSERT' && payload.new) {
              const { data: listing } = await supabase
                .from('listings')
                .select('landlord_id')
                .eq('id', (payload.new as any).listing_id)
                .maybeSingle();

              if (listing?.landlord_id === profile.id) {
                loadNotifications();
              }
            } else if (payload.eventType === 'UPDATE' && payload.new) {
              if ((payload.new as any).student_id === profile.id) {
                loadNotifications();
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(notificationsChannel);
        supabase.removeChannel(messagesChannel);
        supabase.removeChannel(bookingsChannel);
      };
    }
  }, [profile?.id]);

  useEffect(() => {
    if (profile?.id) {
      loadNotifications();
    }
  }, [location.pathname, profile?.id]);

  useEffect(() => {
    if (unreadCount > previousUnreadCountRef.current) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 1000);
    }
    previousUnreadCountRef.current = unreadCount;
  }, [unreadCount]);

  const loadNotifications = async () => {
    if (!profile?.id) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setNotifications(data);
      const newUnreadCount = data.filter(n => !n.is_read).length;
      setUnreadCount(newUnreadCount);
    }
  };

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    setNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    if (!profile?.id) return;

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('is_read', false);

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);

    if (notification.link) {
      if (notification.link === 'messages') {
        navigate('/messages');
      } else if (notification.link === 'bookingRequests') {
        if (profile?.role === 'landlord') {
          navigate('/mes-demandes');
        } else {
          navigate('/mes-reservations');
        }
      }
    }

    setShowDropdown(false);
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'message':
        return '💬';
      case 'booking_request':
        return '📅';
      case 'booking_confirmed':
        return '✅';
      case 'booking_cancelled':
        return '❌';
      default:
        return '🔔';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'À l\'instant';
    if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)}h`;
    if (seconds < 604800) return `Il y a ${Math.floor(seconds / 86400)}j`;
    return date.toLocaleDateString('fr-FR');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`relative p-2 hover:bg-gray-100 rounded-full transition ${
          isAnimating ? 'animate-bounce' : ''
        }`}
      >
        <Bell className={`h-6 w-6 text-gray-700 ${isAnimating ? 'animate-pulse' : ''}`} />
        {unreadCount > 0 && (
          <>
            {isAnimating && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-ping opacity-75" />
            )}
            <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center z-10">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </>
        )}
      </button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-1rem))] sm:w-96 bg-white rounded-xl shadow-2xl border-2 border-gray-200 z-20 max-h-[500px] overflow-hidden flex flex-col">
            <div className="px-3 sm:px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-base sm:text-lg text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                >
                  Marquer lues
                </button>
              )}
            </div>

            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>Aucune notification</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map(notification => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`w-full text-left p-3 sm:p-4 hover:bg-gray-50 transition ${
                        !notification.is_read ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-2 sm:space-x-3">
                        <div className="text-xl sm:text-2xl flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className={`font-semibold text-xs sm:text-sm ${
                              !notification.is_read ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {notification.title}
                            </p>
                            {!notification.is_read && (
                              <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 ml-2" />
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-[10px] sm:text-xs text-gray-400 mt-1">
                            {formatTimeAgo(notification.created_at)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
