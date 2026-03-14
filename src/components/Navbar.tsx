import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Menu, User, Heart, MessageCircle, Calendar, Home, CircleUser as UserCircle, FolderOpen, Shield, CreditCard, KeyRound, FileText, Ligature as FileSignature, BookOpen, Wallet, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (profile?.id) {
      loadNotificationCounts();
    }
  }, [location.pathname, profile?.id]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showUserMenu]);

  useEffect(() => {
    setShowUserMenu(false);
  }, [location.pathname]);

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

  const handleAddListing = () => {
    if (user && profile?.role === 'landlord') {
      navigate('/ajouter-annonce');
      setShowUserMenu(false);
    } else if (user) {
      alert(t('navbar.landlordOnlyMessage'));
    } else {
      navigate('/inscription');
    }
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 lg:px-20">
        <div className="flex justify-between items-center h-16 sm:h-20">
          <Link to="/" className="flex items-center flex-shrink-0">
            <img
              src="/3.png"
              alt="Hellofonty Logo"
              className="h-12 w-12 sm:h-16 sm:w-16 object-contain"
            />
            <span className="ml-2 text-lg sm:text-xl font-semibold text-rose-500 hidden sm:block">
              hellofonty
            </span>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/blog"
              className="p-2 sm:px-5 sm:py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-full transition flex items-center gap-2"
              title="Blog"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden lg:inline">Blog</span>
            </Link>

            <Link
              to="/fonctionnalites"
              className="px-2 sm:px-3 lg:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-full transition"
            >
              <span className="hidden lg:inline">{language === 'fr' ? 'Fonctionnalités' : 'Features'}</span>
              <span className="lg:hidden">{language === 'fr' ? 'Fonct.' : 'Features'}</span>
            </Link>

            <Link
              to="/tarifs"
              className="px-2 sm:px-3 lg:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-full transition"
            >
              {t('nav.pricing')}
            </Link>

            <button
              onClick={handleAddListing}
              className="hidden md:block px-3 lg:px-5 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 rounded-full transition border border-gray-300"
            >
              <span className="hidden lg:inline">{t('nav.addListing')}</span>
              <span className="lg:hidden">+</span>
            </button>

            <button
              onClick={toggleLanguage}
              className="p-2 sm:p-2.5 hover:bg-gray-50 rounded-full transition text-base sm:text-xl flex-shrink-0"
              title={language === 'fr' ? 'Switch to English' : 'Passer en français'}
            >
              {language === 'fr' ? '🇬🇧' : '🇫🇷'}
            </button>

            {user && <NotificationBell />}

            <div className="relative flex-shrink-0" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 sm:gap-3 border border-gray-300 rounded-full py-1.5 px-2 sm:py-2 sm:px-3 hover:shadow-md transition"
              >
                <Menu className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-700" />
                <div className="bg-gray-600 text-white rounded-full p-1 sm:p-1.5">
                  <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
                        <Link
                          to="/admin"
                          onClick={() => setShowUserMenu(false)}
                          className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-3 font-semibold"
                        >
                          <Shield className="h-4 w-4" />
                          <span>Administration</span>
                        </Link>
                      )}

                      {profile?.role !== 'admin' && (
                        <Link
                          to={profile?.role === 'landlord' ? '/dashboard-proprietaire' : '/dashboard'}
                          onClick={() => setShowUserMenu(false)}
                          className="w-full text-left px-4 py-3 text-sm text-rose-600 hover:bg-rose-50 flex items-center space-x-3 font-semibold"
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          <span>{language === 'fr' ? 'Tableau de bord' : 'Dashboard'}</span>
                        </Link>
                      )}

                      <Link
                        to="/messages"
                        onClick={() => setShowUserMenu(false)}
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
                      </Link>

                      {profile?.role === 'student' && (
                        <>
                          <Link
                            to="/mes-reservations"
                            onClick={() => setShowUserMenu(false)}
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
                          </Link>
                          <Link
                            to="/mes-loyers"
                            onClick={() => setShowUserMenu(false)}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                          >
                            <CreditCard className="h-4 w-4" />
                            <span>{language === 'fr' ? 'Mes loyers' : 'My Rents'}</span>
                          </Link>
                          <Link
                            to="/mes-documents"
                            onClick={() => setShowUserMenu(false)}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                          >
                            <FolderOpen className="h-4 w-4" />
                            <span>{language === 'fr' ? 'Mes documents' : 'My Documents'}</span>
                          </Link>
                          <Link
                            to="/favoris"
                            onClick={() => setShowUserMenu(false)}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                          >
                            <Heart className="h-4 w-4" />
                            <span>{t('nav.favorites')}</span>
                          </Link>
                        </>
                      )}

                      {profile?.role === 'landlord' && (
                        <>
                          <Link
                            to="/mes-annonces"
                            onClick={() => setShowUserMenu(false)}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                          >
                            <Home className="h-4 w-4" />
                            <span>{t('nav.myListings')}</span>
                          </Link>
                          <Link
                            to="/mes-demandes"
                            onClick={() => setShowUserMenu(false)}
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
                          </Link>
                          <Link
                            to="/documents-proprietaire"
                            onClick={() => setShowUserMenu(false)}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                          >
                            <FolderOpen className="h-4 w-4" />
                            <span>{language === 'fr' ? 'Mes documents' : 'My Documents'}</span>
                          </Link>
                          <Link
                            to="/guide-acces"
                            onClick={() => setShowUserMenu(false)}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                          >
                            <KeyRound className="h-4 w-4" />
                            <span>{language === 'fr' ? "Guide d'accès" : 'Access Guide'}</span>
                          </Link>
                          <Link
                            to="/etat-des-lieux"
                            onClick={() => setShowUserMenu(false)}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                          >
                            <FileText className="h-4 w-4" />
                            <span>{language === 'fr' ? 'États des lieux' : 'Property Inventory'}</span>
                          </Link>
                          <Link
                            to="/mes-baux"
                            onClick={() => setShowUserMenu(false)}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                          >
                            <FileSignature className="h-4 w-4" />
                            <span>{language === 'fr' ? 'Baux' : 'Leases'}</span>
                          </Link>
                          <Link
                            to="/mon-abonnement"
                            onClick={() => setShowUserMenu(false)}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                          >
                            <CreditCard className="h-4 w-4" />
                            <span>{language === 'fr' ? 'Mon abonnement' : 'My Subscription'}</span>
                          </Link>
                          <Link
                            to="/proprietaire/paiements"
                            onClick={() => setShowUserMenu(false)}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                          >
                            <Wallet className="h-4 w-4" />
                            <span>{language === 'fr' ? 'Paiements' : 'Payouts'}</span>
                          </Link>
                          <Link
                            to="/proprietaire/loyers"
                            onClick={() => setShowUserMenu(false)}
                            className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                          >
                            <CreditCard className="h-4 w-4" />
                            <span>{language === 'fr' ? 'Loyers mensuels' : 'Monthly Rents'}</span>
                          </Link>
                        </>
                      )}

                      <Link
                        to="/profil"
                        onClick={() => setShowUserMenu(false)}
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
                      </Link>

                      <div className="border-t border-gray-200 mt-2 pt-2">
                        <button
                          onClick={async () => {
                            try {
                              await signOut();
                              setShowUserMenu(false);
                              navigate('/');
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
                      <Link
                        to="/inscription"
                        onClick={() => setShowUserMenu(false)}
                        className="w-full text-left px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 block"
                      >
                        {t('nav.signUp')}
                      </Link>
                      <Link
                        to="/connexion"
                        onClick={() => setShowUserMenu(false)}
                        className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 block"
                      >
                        {t('nav.signIn')}
                      </Link>
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
