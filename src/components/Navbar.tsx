import { Search, Menu, User, Heart, MessageCircle, Calendar, Home, CircleUser as UserCircle, FolderOpen, Shield, CreditCard, KeyRound, FileText, FileSignature } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import NotificationBell from './NotificationBell';

type NavbarProps = {
  currentPage: string;
  onNavigate: (page: string) => void;
};

export default function Navbar({ currentPage, onNavigate }: NavbarProps) {
  const { user, profile, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notificationCounts, setNotificationCounts] = useState({
    messages: 0,
    bookingRequests: 0,
    documents: 0
  });

  useEffect(() => {
    if (profile?.id) {
      loadNotificationCounts();

      const notificationsChannel = supabase
        .channel('navbar-notifications')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${profile.id}`,
          },
          () => {
            loadNotificationCounts();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(notificationsChannel);
      };
    }
  }, [profile?.id]);

  const loadNotificationCounts = async () => {
    if (!profile?.id) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('type, is_read')
      .eq('user_id', profile.id)
      .eq('is_read', false);

    if (!error && data) {
      const counts = {
        messages: data.filter(n => n.type === 'message').length,
        bookingRequests: data.filter(n =>
          n.type === 'booking_request' ||
          n.type === 'booking_confirmed' ||
          n.type === 'booking_cancelled'
        ).length,
        documents: 0
      };
      setNotificationCounts(counts);
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'fr' ? 'en' : 'fr');
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-20">
        <div className="flex justify-between items-center h-20">
          <div
            className="flex items-center cursor-pointer"
            onClick={() => onNavigate('home')}
          >
            <img
              src="/3.png"
              alt="Hellofonty Logo"
              className="h-16 w-16 object-contain"
            />
            <span className="ml-2 text-xl font-semibold text-rose-500 hidden sm:block">
              hellofonty
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onNavigate('pricing')}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-full transition"
            >
              {t('nav.pricing')}
            </button>

            <button
              onClick={() => {
                if (user && profile?.role === 'landlord') {
                  onNavigate('addListing');
                } else if (user) {
                  alert(t('navbar.landlordOnlyMessage')
                  );
                } else {
                  onNavigate('signup');
                }
              }}
              className="hidden md:block px-5 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 rounded-full transition border border-gray-300"
            >
              {t('nav.addListing')}
            </button>

            <button
              onClick={toggleLanguage}
              className="p-2.5 hover:bg-gray-50 rounded-full transition text-xl"
              title={language === 'fr' ? 'Switch to English' : 'Passer en français'}
            >
              {language === 'fr' ? '🇬🇧' : '🇫🇷'}
            </button>

            {user && <NotificationBell onNavigate={onNavigate} />}

            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-3 border border-gray-300 rounded-full py-2 px-3 hover:shadow-md transition"
              >
                <Menu className="h-4 w-4 text-gray-700" />
                <div className="bg-gray-600 text-white rounded-full p-1.5">
                  <User className="h-4 w-4" />
                </div>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-200 py-2">
                  {user ? (
                    <>
                      <div className="px-4 py-3 border-b border-gray-200">
                        <p className="text-sm font-medium text-gray-900">
                          {profile?.first_name} {profile?.last_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {profile?.role === 'admin' ? 'Admin' : profile?.role === 'student' ? t('auth.student') : t('auth.landlord')}
                        </p>
                      </div>

                      {profile?.role === 'admin' && (
                        <button
                          onClick={() => {
                            onNavigate('admin');
                            setShowUserMenu(false);
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-3 font-semibold"
                        >
                          <Shield className="h-4 w-4" />
                          <span>Administration</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          onNavigate('messages');
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3">
                          <MessageCircle className="h-4 w-4" />
                          <span>{t('nav.messages')}</span>
                        </div>
                        {notificationCounts.messages > 0 && (
                          <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center">
                            {notificationCounts.messages > 9 ? '9+' : notificationCounts.messages}
                          </span>
                        )}
                      </button>

                      {profile?.role === 'student' && (
                        <>
                          <button
                            onClick={() => {
                              onNavigate('myBookingRequestsStudent');
                              setShowUserMenu(false);
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-3">
                              <Calendar className="h-4 w-4" />
                              <span>{t('nav.myBookingRequests')}</span>
                            </div>
                            {notificationCounts.bookingRequests > 0 && (
                              <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center">
                                {notificationCounts.bookingRequests > 9 ? '9+' : notificationCounts.bookingRequests}
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              onNavigate('myDocuments');
                              setShowUserMenu(false);
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                          >
                            <FolderOpen className="h-4 w-4" />
                            <span>{language === 'fr' ? 'Mes documents' : 'My Documents'}</span>
                          </button>
                          <button
                            onClick={() => {
                              onNavigate('favorites');
                              setShowUserMenu(false);
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                          >
                            <Heart className="h-4 w-4" />
                            <span>{t('nav.favorites')}</span>
                          </button>
                        </>
                      )}

                      {profile?.role === 'landlord' && (
                        <>
                          <button
                            onClick={() => {
                              onNavigate('myListings');
                              setShowUserMenu(false);
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                          >
                            <Home className="h-4 w-4" />
                            <span>{t('nav.myListings')}</span>
                          </button>
                          <button
                            onClick={() => {
                              onNavigate('myBookingRequests');
                              setShowUserMenu(false);
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-3">
                              <Calendar className="h-4 w-4" />
                              <span>{t('nav.myBookingRequests')}</span>
                            </div>
                            {notificationCounts.bookingRequests > 0 && (
                              <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center">
                                {notificationCounts.bookingRequests > 9 ? '9+' : notificationCounts.bookingRequests}
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              onNavigate('myDocumentsLandlord');
                              setShowUserMenu(false);
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                          >
                            <FolderOpen className="h-4 w-4" />
                            <span>{language === 'fr' ? 'Mes documents' : 'My Documents'}</span>
                          </button>
                          <button
                            onClick={() => {
                              onNavigate('accessGuide');
                              setShowUserMenu(false);
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                          >
                            <KeyRound className="h-4 w-4" />
                            <span>{language === 'fr' ? "Guide d'accès" : 'Access Guide'}</span>
                          </button>
                          <button
                            onClick={() => {
                              onNavigate('propertyInventory');
                              setShowUserMenu(false);
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                          >
                            <FileText className="h-4 w-4" />
                            <span>{language === 'fr' ? 'États des lieux' : 'Property Inventory'}</span>
                          </button>
                          <button
                            onClick={() => {
                              onNavigate('leases');
                              setShowUserMenu(false);
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                          >
                            <FileSignature className="h-4 w-4" />
                            <span>{language === 'fr' ? 'Baux' : 'Leases'}</span>
                          </button>
                          <button
                            onClick={() => {
                              onNavigate('mySubscription');
                              setShowUserMenu(false);
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                          >
                            <CreditCard className="h-4 w-4" />
                            <span>{language === 'fr' ? 'Mon abonnement' : 'My Subscription'}</span>
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => {
                          onNavigate('profile');
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                      >
                        <UserCircle className="h-4 w-4" />
                        <span>{t('nav.profile')}</span>
                        {profile?.role === 'student' && (
                          <div className="ml-auto">
                            {profile.verification_status === 'approved' ? (
                              <div className="w-2.5 h-2.5 bg-green-500 rounded-full" title="Compte vérifié" />
                            ) : profile.verification_status === 'pending' ? (
                              <div className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-pulse" title="Vérification en cours" />
                            ) : (
                              <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" title="Action requise" />
                            )}
                          </div>
                        )}
                      </button>

                      <div className="border-t border-gray-200 mt-2 pt-2">
                        <button
                          onClick={async () => {
                            try {
                              await signOut();
                              setShowUserMenu(false);
                              onNavigate('home');
                              setTimeout(() => {
                                window.location.reload();
                              }, 100);
                            } catch (error) {
                              console.error('Error signing out:', error);
                            }
                          }}
                          className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          {t('nav.signOut')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          onNavigate('signup');
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50"
                      >
                        {t('nav.signUp')}
                      </button>
                      <button
                        onClick={() => {
                          onNavigate('signin');
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {t('nav.signIn')}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
