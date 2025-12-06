import { useState, useEffect } from 'react';
import { Send, User, CheckCircle, XCircle, Calendar, Shield, Key, ArrowLeft } from 'lucide-react';
import { supabase, Message } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { detectProhibitedContent, shouldAllowContactSharing } from '../utils/messageDetection';
import BlockedMessageModal from '../components/BlockedMessageModal';

type Conversation = {
  otherUserId: string;
  otherUserName: string;
  lastMessage: string;
  lastMessageDate: string;
  unreadCount: number;
};

type MessagesProps = {
  selectedUserId?: string;
};

export default function Messages({ selectedUserId }: MessagesProps) {
  const { t } = useLanguage();
  const { profile } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [contactAllowed, setContactAllowed] = useState(false);
  const [attemptsCount, setAttemptsCount] = useState(0);
  const [accessGuides, setAccessGuides] = useState<any[]>([]);
  const [showGuideMenu, setShowGuideMenu] = useState(false);

  useEffect(() => {
    if (profile) {
      loadConversations();
      loadAccessGuides();
      markMessageNotificationsAsRead();
    }
  }, [profile]);

  const markMessageNotificationsAsRead = async () => {
    if (!profile?.id) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('type', 'message')
      .eq('is_read', false);

    if (!error) {
      console.log('Notifications messages marquées comme lues');
    }
  };

  useEffect(() => {
    const initializeConversation = async () => {
      if (selectedUserId) {
        const existingConv = conversations.find(c => c.otherUserId === selectedUserId);
        if (existingConv) {
          setSelectedConversation(selectedUserId);
        } else {
          const { data: userData, error } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', selectedUserId)
            .maybeSingle();

          if (!error && userData) {
            const newConv: Conversation = {
              otherUserId: selectedUserId,
              otherUserName: `${userData.first_name} ${userData.last_name}`,
              lastMessage: '',
              lastMessageDate: new Date().toISOString(),
              unreadCount: 0,
            };
            setConversations(prev => [newConv, ...prev]);
            setSelectedConversation(selectedUserId);
          }
        }
      }
    };

    if (selectedUserId) {
      initializeConversation();
    }
  }, [selectedUserId]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation);
      markAsRead(selectedConversation);
      checkContactPermission(selectedConversation);
      loadAttemptsCount();

      const bookingsUpdateChannel = supabase
        .channel(`bookings-updates-${selectedConversation}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'bookings',
          },
          () => {
            console.log('Booking mis à jour, rechargement des permissions de contact');
            checkContactPermission(selectedConversation);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(bookingsUpdateChannel);
      };
    }
  }, [selectedConversation]);

  const checkContactPermission = async (otherUserId: string) => {
    if (!profile) return;
    console.log('Vérification des permissions de contact entre', profile.id, 'et', otherUserId);
    const allowed = await shouldAllowContactSharing(profile.id, otherUserId, supabase);
    console.log('Contact autorisé:', allowed);
    setContactAllowed(allowed);
  };

  const loadAttemptsCount = async () => {
    if (!profile) return;
    const { data, error } = await supabase.rpc('get_user_blocked_attempts_count', {
      target_user_id: profile.id,
    });
    if (!error && data !== null) {
      setAttemptsCount(data);
    }
  };

  const loadAccessGuides = async () => {
    if (!profile || profile.user_type !== 'landlord') return;

    const { data: listingsData, error: listingsError } = await supabase
      .from('listings')
      .select('id')
      .eq('landlord_id', profile.id);

    if (listingsError || !listingsData || listingsData.length === 0) return;

    const listingIds = listingsData.map(l => l.id);

    const { data, error } = await supabase
      .from('access_guides')
      .select(`
        id,
        share_token,
        listing:listings(title, address)
      `)
      .in('listing_id', listingIds)
      .not('share_token', 'is', null);

    if (!error && data) {
      setAccessGuides(data);
    }
  };

  const insertAccessGuideLink = (guide: any) => {
    const shareUrl = `${window.location.origin}/partage/${guide.share_token}`;
    const messageText = `📍 Guide d'accès pour ${guide.listing.title}\n\nVoici le lien vers le guide d'accès complet de votre logement avec toutes les instructions nécessaires :\n\n${shareUrl}\n\nVous y trouverez : les codes d'accès, le WiFi, les instructions de stationnement et toutes les informations pratiques.`;
    setNewMessage(messageText);
    setShowGuideMenu(false);
  };

  const loadConversations = async () => {
    if (!profile) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(*), recipient:profiles!recipient_id(*)')
      .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const convMap = new Map<string, Conversation>();

      data.forEach((msg) => {
        const otherUserId =
          msg.sender_id === profile.id ? msg.recipient_id : msg.sender_id;
        const otherUser =
          msg.sender_id === profile.id ? msg.recipient : msg.sender;

        if (!convMap.has(otherUserId)) {
          convMap.set(otherUserId, {
            otherUserId,
            otherUserName: `${otherUser?.first_name} ${otherUser?.last_name}`,
            lastMessage: msg.content,
            lastMessageDate: msg.created_at,
            unreadCount:
              msg.recipient_id === profile.id && !msg.is_read ? 1 : 0,
          });
        } else {
          const conv = convMap.get(otherUserId)!;
          if (msg.recipient_id === profile.id && !msg.is_read) {
            conv.unreadCount++;
          }
        }
      });

      setConversations(Array.from(convMap.values()));
    }
    setLoading(false);
  };

  const loadMessages = async (otherUserId: string) => {
    if (!profile) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:profiles!sender_id(*), recipient:profiles!recipient_id(*), booking:bookings!booking_id(*)')
      .or(
        `and(sender_id.eq.${profile.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${profile.id})`
      )
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
  };

  const markAsRead = async (otherUserId: string) => {
    if (!profile) return;

    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', otherUserId)
      .eq('recipient_id', profile.id)
      .eq('is_read', false);

    setConversations((prev) =>
      prev.map((conv) =>
        conv.otherUserId === otherUserId ? { ...conv, unreadCount: 0 } : conv
      )
    );
  };

  const sendMessage = async () => {
    if (!profile || !selectedConversation || !newMessage.trim()) return;

    if (!contactAllowed) {
      const detection = detectProhibitedContent(newMessage.trim());

      if (detection.isBlocked) {
        setShowBlockedModal(true);

        await supabase.from('blocked_messages').insert({
          user_id: profile.id,
          recipient_id: selectedConversation,
          blocked_content: newMessage.trim(),
          detection_type: detection.detectionType,
          detected_patterns: detection.detectedPatterns,
        });

        await loadAttemptsCount();
        setSending(false);
        return;
      }
    }

    setSending(true);
    const { error } = await supabase.from('messages').insert({
      sender_id: profile.id,
      recipient_id: selectedConversation,
      content: newMessage.trim(),
    });

    if (!error) {
      setNewMessage('');
      await loadMessages(selectedConversation);
      await loadConversations();
    }
    setSending(false);
  };

  const handleBookingAction = async (bookingId: string, action: 'confirmed' | 'cancelled') => {
    const { data: bookingData, error: bookingError } = await supabase
      .from('bookings')
      .update({ status: action })
      .eq('id', bookingId)
      .select('*, listing:listings(*), student:profiles!student_id(*)')
      .single();

    if (!bookingError && bookingData) {
      const statusText = action === 'confirmed' ? 'confirmée' : 'refusée';
      const messageContent = `✅ Demande de réservation ${statusText}

Votre demande de réservation a été ${statusText} par le propriétaire.`;

      await supabase.from('messages').insert({
        sender_id: profile!.id,
        recipient_id: bookingData.student_id,
        listing_id: bookingData.listing_id,
        booking_id: bookingId,
        content: messageContent,
      });

      await supabase.from('notifications').insert({
        user_id: bookingData.student_id,
        type: action === 'confirmed' ? 'booking_confirmed' : 'booking_cancelled',
        title: `Demande ${statusText}`,
        message: `Votre demande de réservation pour ${bookingData.listing?.title} a été ${statusText}`,
        link: `/bookings/${bookingId}`,
      });

      if (selectedConversation) {
        await loadMessages(selectedConversation);
      }
      alert(`Demande de réservation ${statusText} avec succès!`);
    } else {
      alert('Erreur lors de la mise à jour de la réservation');
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] bg-gray-50">
      <div className="max-w-7xl mx-auto h-full flex">
        <div className={`w-full md:w-1/3 bg-white border-r overflow-y-auto ${selectedConversation ? 'hidden md:block' : 'block'}`}>
          <div className="p-6 border-b">
            <h2 className="text-2xl font-bold text-gray-900">{t('messages.conversations')}</h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 px-4">
              <p className="text-gray-600">{t('messages.empty')}</p>
            </div>
          ) : (
            <div>
              {conversations.map((conv) => (
                <div
                  key={conv.otherUserId}
                  onClick={() => setSelectedConversation(conv.otherUserId)}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition ${
                    selectedConversation === conv.otherUserId ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{conv.otherUserName}</h3>
                        <p className="text-sm text-gray-600 truncate max-w-[200px]">
                          {conv.lastMessage}
                        </p>
                      </div>
                    </div>
                    {conv.unreadCount > 0 && (
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {conv.unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`w-full md:w-2/3 flex-col bg-white ${selectedConversation ? 'flex' : 'hidden md:flex'}`}>
          {selectedConversation ? (
            <>
              <div className="p-3 sm:p-6 border-b flex items-center gap-2 sm:gap-4">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="md:hidden p-1 sm:p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
                </button>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                  {conversations.find((c) => c.otherUserId === selectedConversation)
                    ?.otherUserName}
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.sender_id === profile?.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[70%] ${
                        msg.booking_id ? 'sm:min-w-[400px]' : ''
                      }`}
                    >
                      <div
                        className={`px-3 sm:px-4 py-2 sm:py-3 rounded-2xl ${
                          msg.sender_id === profile?.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words text-sm sm:text-base">{msg.content}</p>
                        <p
                          className={`text-[10px] sm:text-xs mt-1 ${
                            msg.sender_id === profile?.id
                              ? 'text-blue-100'
                              : 'text-gray-500'
                          }`}
                        >
                          {new Date(msg.created_at).toLocaleString()}
                        </p>
                      </div>

                      {msg.booking_id && msg.booking && msg.booking.status === 'pending' && profile?.role === 'landlord' && msg.sender_id !== profile?.id && (
                        <div className="mt-3 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                          <button
                            onClick={() => handleBookingAction(msg.booking_id!, 'confirmed')}
                            className="flex-1 flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-sm sm:text-base"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>{t('booking.accept')}</span>
                          </button>
                          <button
                            onClick={() => handleBookingAction(msg.booking_id!, 'cancelled')}
                            className="flex-1 flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold text-sm sm:text-base"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>{t('booking.decline')}</span>
                          </button>
                        </div>
                      )}

                      {msg.booking_id && msg.booking && msg.booking.status !== 'pending' && (
                        <div className={`mt-2 px-3 py-1.5 rounded-full inline-flex items-center space-x-1 text-sm font-medium ${
                          msg.booking.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {msg.booking.status === 'confirmed' ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          <span>{msg.booking.status === 'confirmed' ? 'Confirmée' : 'Refusée'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 sm:p-6 border-t">
                {contactAllowed && (
                  <div className="mb-3 sm:mb-4 bg-green-50 border border-green-200 rounded-lg p-2 sm:p-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
                    <p className="text-xs sm:text-sm text-green-800">
                      {t('messages.contactAllowed') || 'Réservation confirmée : vous pouvez échanger vos coordonnées en toute sécurité.'}
                    </p>
                  </div>
                )}

                {/* Bouton pour partager un guide d'accès */}
                {profile?.user_type === 'landlord' && accessGuides.length > 0 && (
                  <div className="mb-4 relative">
                    <button
                      onClick={() => setShowGuideMenu(!showGuideMenu)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                    >
                      <Key className="w-4 h-4" />
                      <span className="text-sm font-medium">Partager un guide d'accès</span>
                    </button>

                    {showGuideMenu && (
                      <div className="absolute bottom-full mb-2 left-0 bg-white rounded-lg shadow-lg border border-gray-200 p-2 min-w-[300px] max-h-[300px] overflow-y-auto z-10">
                        <div className="text-xs text-gray-500 font-medium px-3 py-2 border-b">
                          Sélectionnez un logement
                        </div>
                        {accessGuides.map((guide) => (
                          <button
                            key={guide.id}
                            onClick={() => insertAccessGuideLink(guide)}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded transition-colors"
                          >
                            <p className="font-medium text-gray-900 text-sm">{guide.listing?.title}</p>
                            <p className="text-xs text-gray-500">{guide.listing?.address}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex space-x-2 sm:space-x-4">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder={t('messages.typeMessage')}
                    className="flex-1 px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !newMessage.trim()}
                    className="px-3 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-1 sm:space-x-2"
                  >
                    <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="hidden sm:inline">{t('messages.send')}</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-600 text-lg">{t('messages.empty')}</p>
            </div>
          )}
        </div>
      </div>

      <BlockedMessageModal
        isOpen={showBlockedModal}
        onClose={() => setShowBlockedModal(false)}
        onModify={() => setShowBlockedModal(false)}
        attemptsCount={attemptsCount}
      />
    </div>
  );
}
