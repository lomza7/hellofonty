import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, X, Minimize2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type Message = {
  id: string;
  sender_type: 'user' | 'admin';
  message: string;
  created_at: string;
  read: boolean;
};

type Conversation = {
  id: string;
  status: string;
  last_message_at: string;
  user_email?: string;
  user_type?: string;
};

type ChatStep = 'type_selection' | 'email_input' | 'chat';

export default function SupportChat() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentStep, setCurrentStep] = useState<ChatStep>('type_selection');
  const [userType, setUserType] = useState<'student' | 'landlord' | null>(null);
  const [guestEmail, setGuestEmail] = useState('');
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (user) {
        loadAllConversations();
        setCurrentStep('chat');
      } else {
        const savedEmail = localStorage.getItem('support_guest_email');
        const savedType = localStorage.getItem('support_guest_type') as 'student' | 'landlord' | null;
        const savedConvId = localStorage.getItem('support_conversation_id');

        if (savedEmail && savedType && savedConvId) {
          setGuestEmail(savedEmail);
          setUserType(savedType);
          setConversationId(savedConvId);
          setCurrentStep('chat');
        } else {
          setCurrentStep('type_selection');
        }
      }
    }
  }, [user, isOpen]);

  useEffect(() => {
    if (conversationId) {
      loadMessages();
      const subscription = supabase
        .channel(`support_messages:${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'support_messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as Message]);
            if (payload.new.sender_type === 'admin' && !isOpen) {
              setUnreadCount((prev) => prev + 1);
            }
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [conversationId, isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadAllConversations = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('support_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllConversations(data || []);

      const openConv = data?.find(c => c.status !== 'closed');
      if (openConv) {
        setConversationId(openConv.id);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const createConversation = async () => {
    try {
      const convData: any = {
        status: 'open',
      };

      if (user) {
        convData.user_id = user.id;
      } else {
        convData.user_email = guestEmail;
        convData.user_type = userType;
      }

      const { data: newConv, error } = await supabase
        .from('support_conversations')
        .insert(convData)
        .select()
        .single();

      if (error) throw error;

      setConversationId(newConv.id);

      if (!user) {
        localStorage.setItem('support_guest_email', guestEmail);
        localStorage.setItem('support_guest_type', userType!);
        localStorage.setItem('support_conversation_id', newConv.id);
      }

      setCurrentStep('chat');
    } catch (error) {
      console.error('Error creating conversation:', error);
      alert('Erreur lors de la création de la conversation');
    }
  };

  const loadMessages = async () => {
    if (!conversationId) return;

    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      const unread = data?.filter((m) => m.sender_type === 'admin' && !m.read).length || 0;
      setUnreadCount(unread);

      await supabase
        .from('support_messages')
        .update({ read: true })
        .eq('conversation_id', conversationId)
        .eq('sender_type', 'admin')
        .eq('read', false);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !conversationId) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('support_messages').insert({
        conversation_id: conversationId,
        sender_id: user?.id || null,
        sender_type: 'user',
        message: newMessage.trim(),
      });

      if (error) {
        console.error('Error sending message:', error);
        alert('Erreur lors de l\'envoi du message: ' + error.message);
        setLoading(false);
        return;
      }

      await supabase
        .from('support_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      setNewMessage('');
      await loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Erreur lors de l\'envoi du message');
    } finally {
      setLoading(false);
    }
  };

  const handleTypeSelection = (type: 'student' | 'landlord') => {
    setUserType(type);
    if (user) {
      createConversation();
    } else {
      setCurrentStep('email_input');
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestEmail.trim() || !guestEmail.includes('@')) {
      alert('Veuillez entrer un email valide');
      return;
    }
    createConversation();
  };

  const selectConversation = (conv: Conversation) => {
    setConversationId(conv.id);
    setShowHistory(false);
  };

  const startNewConversation = async () => {
    setConversationId(null);
    setMessages([]);
    setShowHistory(false);
    if (user) {
      await createConversation();
    } else {
      setCurrentStep('type_selection');
      setUserType(null);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setIsOpen(true);
          setUnreadCount(0);
        }}
        className="fixed bottom-6 right-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white p-3.5 rounded-full shadow-lg hover:shadow-xl hover:from-blue-600 hover:to-blue-700 transition-all transform hover:scale-110 relative"
        style={{ zIndex: 9999 }}
      >
        <MessageCircle className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 w-96 bg-white rounded-2xl shadow-2xl flex flex-col transition-all ${
        isMinimized ? 'h-16' : 'h-[600px]'
      }`}
      style={{ zIndex: 9999 }}
    >
      <div className="bg-gradient-to-r from-rose-500 to-rose-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-5 h-5" />
          <div>
            <h3 className="font-semibold">Support Client</h3>
            <p className="text-xs text-rose-100">{t('support.helpMessage')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="hover:bg-rose-600 p-1 rounded transition"
          >
            <Minimize2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="hover:bg-rose-600 p-1 rounded transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {currentStep === 'type_selection' && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center space-y-6 w-full">
                <MessageCircle className="w-16 h-16 mx-auto text-rose-500" />
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Bienvenue !
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {t('support.roleQuestion')}
                  </p>
                </div>
                <div className="space-y-3">
                  <button
                    onClick={() => handleTypeSelection('student')}
                    className="w-full py-4 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition"
                  >
                    Étudiant
                  </button>
                  <button
                    onClick={() => handleTypeSelection('landlord')}
                    className="w-full py-4 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition"
                  >
                    Propriétaire
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'email_input' && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="w-full space-y-6">
                <div className="text-center">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Votre email
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Pour que nous puissions vous répondre
                  </p>
                </div>
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="votre.email@exemple.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent"
                    required
                  />
                  <button
                    type="submit"
                    className="w-full py-3 bg-rose-500 text-white rounded-xl font-semibold hover:bg-rose-600 transition"
                  >
                    Continuer
                  </button>
                </form>
                <button
                  onClick={() => setCurrentStep('type_selection')}
                  className="w-full text-gray-500 text-sm hover:text-gray-700"
                >
                  ← Retour
                </button>
              </div>
            </div>
          )}

          {currentStep === 'chat' && (
            <>
              {user && allConversations.length > 0 && (
                <div className="border-b border-gray-200 p-2 flex gap-2">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex-1 text-sm px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                  >
                    {showHistory ? 'Masquer' : 'Historique'} ({allConversations.length})
                  </button>
                  <button
                    onClick={startNewConversation}
                    className="text-sm px-3 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition"
                  >
                    Nouveau
                  </button>
                </div>
              )}

              {showHistory ? (
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
                  {allConversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => selectConversation(conv)}
                      className={`w-full p-3 rounded-lg border text-left transition ${
                        conv.id === conversationId
                          ? 'bg-rose-50 border-rose-300'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            conv.status === 'open'
                              ? 'bg-blue-100 text-blue-700'
                              : conv.status === 'in_progress'
                              ? 'bg-yellow-100 text-yellow-700'
                              : conv.status === 'resolved'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {conv.status === 'open'
                            ? 'Ouvert'
                            : conv.status === 'in_progress'
                            ? 'En cours'
                            : conv.status === 'resolved'
                            ? 'Résolu'
                            : 'Fermé'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(conv.last_message_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-500 mt-8">
                        <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p className="font-semibold">Besoin d'aide ?</p>
                        <p className="text-sm mt-1">
                          Posez-nous vos questions, nous vous répondrons rapidement !
                        </p>
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${
                            msg.sender_type === 'user' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                              msg.sender_type === 'user'
                                ? 'bg-rose-500 text-white rounded-br-none'
                                : 'bg-white text-gray-800 rounded-bl-none shadow-sm'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {msg.message}
                            </p>
                            <p
                              className={`text-xs mt-1 ${
                                msg.sender_type === 'user'
                                  ? 'text-rose-100'
                                  : 'text-gray-500'
                              }`}
                            >
                              {new Date(msg.created_at).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <form
                    onSubmit={sendMessage}
                    className="p-4 bg-white border-t rounded-b-2xl"
                  >
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Écrivez votre message..."
                        className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition"
                        disabled={loading}
                      />
                      <button
                        type="submit"
                        disabled={loading || !newMessage.trim()}
                        className="bg-rose-500 text-white p-3 rounded-xl hover:bg-rose-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </form>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
