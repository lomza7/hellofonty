import { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  Send,
  X,
  Minus,
  Video,
  ChevronLeft,
  Headphones,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

type Message = {
  id: string;
  sender_type: 'user' | 'admin';
  message: string;
  created_at: string;
  read: boolean;
};

type ChatView = 'home' | 'type_selection' | 'email_input' | 'chat' | 'visio';

export default function SupportChat() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentView, setCurrentView] = useState<ChatView>('home');
  const [userType, setUserType] = useState<'student' | 'landlord' | null>(null);
  const [guestEmail, setGuestEmail] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && currentView === 'home') {
      if (user) {
        loadExistingConversation();
      } else {
        const savedConvId = localStorage.getItem('support_conversation_id');
        const savedEmail = localStorage.getItem('support_guest_email');
        const savedType = localStorage.getItem('support_guest_type') as 'student' | 'landlord' | null;
        if (savedConvId && savedEmail && savedType) {
          setGuestEmail(savedEmail);
          setUserType(savedType);
          setConversationId(savedConvId);
        }
      }
    }
  }, [user, isOpen]);

  useEffect(() => {
    if (conversationId) {
      loadMessages();
      const subscription = supabase
        .channel(`support_msgs_${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'support_messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const newMsg = payload.new as Message;
            setMessages((prev) => {
              if (prev.find(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            if (newMsg.sender_type === 'admin' && !isOpen) {
              setUnreadCount((prev) => prev + 1);
            }
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadExistingConversation = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('support_conversations')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setConversationId(data.id);
    }
  };

  const createConversation = async () => {
    try {
      const convData: Record<string, unknown> = { status: 'open' };

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

      return newConv.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
  };

  const loadMessages = async () => {
    if (!conversationId) return;

    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    setMessages(data || []);

    const unread = data?.filter((m) => m.sender_type === 'admin' && !m.read).length || 0;
    setUnreadCount(unread);

    await supabase
      .from('support_messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .eq('sender_type', 'admin')
      .eq('read', false);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setLoading(true);
    try {
      let activeConvId = conversationId;
      if (!activeConvId) {
        activeConvId = await createConversation();
        if (!activeConvId) return;
      }

      const { error } = await supabase.from('support_messages').insert({
        conversation_id: activeConvId,
        sender_id: user?.id || null,
        sender_type: 'user',
        message: newMessage.trim(),
      });

      if (error) throw error;

      await supabase
        .from('support_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', activeConvId);

      setNewMessage('');
      await loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = () => {
    if (user) {
      setCurrentView('chat');
    } else {
      setCurrentView('type_selection');
    }
  };

  const handleTypeSelection = (type: 'student' | 'landlord') => {
    setUserType(type);
    setCurrentView('email_input');
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestEmail.trim() || !guestEmail.includes('@')) return;
    await createConversation();
    setCurrentView('chat');
  };

  const fr = language === 'fr';

  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setIsOpen(true);
          setUnreadCount(0);
        }}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-gradient-to-br from-teal-500 to-teal-600 text-white p-3.5 sm:p-4 rounded-full shadow-xl hover:shadow-2xl hover:from-teal-600 hover:to-teal-700 transition-all transform hover:scale-110 group"
        style={{ zIndex: 9999 }}
      >
        <Headphones className="w-5 h-5 sm:w-6 sm:h-6 group-hover:scale-110 transition-transform" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-bounce">
            {unreadCount}
          </span>
        )}
        <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden sm:block">
          {fr ? 'Besoin d\'aide ?' : 'Need help?'}
        </span>
      </button>
    );
  }

  return (
    <div
      className={`fixed inset-x-0 bottom-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[360px] bg-white sm:rounded-2xl shadow-2xl flex flex-col transition-all duration-300 border-t sm:border border-gray-200 ${
        isMinimized ? 'h-[60px] sm:rounded-2xl' : 'h-[85vh] sm:h-[500px]'
      }`}
      style={{ zIndex: 9999 }}
    >
      <div
        className="bg-gradient-to-r from-teal-600 to-teal-700 text-white px-4 py-3 sm:rounded-t-2xl flex items-center justify-between cursor-pointer flex-shrink-0"
        onClick={() => isMinimized && setIsMinimized(false)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <Headphones className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{fr ? 'Support Hellofonty' : 'Hellofonty Support'}</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              <span className="text-[11px] text-teal-100">{fr ? 'En ligne' : 'Online'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
            className="hover:bg-white/10 p-1.5 rounded-lg transition"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
            className="hover:bg-white/10 p-1.5 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {currentView === 'home' && (
            <HomeView
              fr={fr}
              onStartChat={handleStartChat}
              onVisio={() => setCurrentView('visio')}
            />
          )}

          {currentView === 'type_selection' && (
            <TypeSelectionView
              fr={fr}
              onSelect={handleTypeSelection}
              onBack={() => setCurrentView('home')}
            />
          )}

          {currentView === 'email_input' && (
            <EmailInputView
              fr={fr}
              email={guestEmail}
              onEmailChange={setGuestEmail}
              onSubmit={handleEmailSubmit}
              onBack={() => setCurrentView('type_selection')}
            />
          )}

          {currentView === 'chat' && (
            <MessagesView
              fr={fr}
              messages={messages}
              newMessage={newMessage}
              onNewMessageChange={setNewMessage}
              onSend={sendMessage}
              loading={loading}
              messagesEndRef={messagesEndRef}
              onBack={() => setCurrentView('home')}
            />
          )}

          {currentView === 'visio' && (
            <VisioView
              fr={fr}
              onBack={() => setCurrentView('home')}
            />
          )}
        </div>
      )}
    </div>
  );
}

function HomeView({
  fr,
  onStartChat,
  onVisio,
}: {
  fr: boolean;
  onStartChat: () => void;
  onVisio: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col p-4 sm:p-5 overflow-y-auto">
      <div className="text-center mb-4">
        <div className="w-12 h-12 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-2.5">
          <Headphones className="w-6 h-6 text-teal-600" />
        </div>
        <h3 className="text-base font-bold text-gray-900">
          {fr ? 'Comment pouvons-nous vous aider ?' : 'How can we help you?'}
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          {fr ? 'Choisissez une option ci-dessous' : 'Choose an option below'}
        </p>
      </div>

      <div className="space-y-2.5 flex-1">
        <a
          href="https://wa.me/33778327915"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-3 p-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl transition-all group text-left"
        >
          <div className="w-10 h-10 bg-[#25D366] rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">
              {fr ? 'Parler par WhatsApp' : 'Chat on WhatsApp'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {fr ? 'Echangez directement avec nous' : 'Chat with us directly'}
            </p>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        </a>

        <button
          onClick={onVisio}
          className="w-full flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all group text-left"
        >
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">
              {fr ? 'Prendre un RDV en visio' : 'Book a video call'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {fr ? 'Choisissez un creneau qui vous convient' : 'Pick a time that works for you'}
            </p>
          </div>
        </button>

        <button
          onClick={onStartChat}
          className="w-full flex items-center gap-3 p-3 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-all group text-left"
        >
          <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">
              {fr ? 'Discuter avec nous' : 'Chat with us'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {fr ? 'Reponse rapide par ecrit' : 'Quick written response'}
            </p>
          </div>
        </button>
      </div>

      <div className="mt-3 pt-2.5 border-t border-gray-100 text-center">
        <p className="text-[11px] text-gray-400">
          {fr ? 'Disponible du lundi au vendredi, 9h-18h' : 'Available Monday-Friday, 9am-6pm'}
        </p>
      </div>
    </div>
  );
}

function TypeSelectionView({
  fr,
  onSelect,
  onBack,
}: {
  fr: boolean;
  onSelect: (type: 'student' | 'landlord') => void;
  onBack: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col p-5">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ChevronLeft className="w-4 h-4" />
        {fr ? 'Retour' : 'Back'}
      </button>

      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          {fr ? 'Vous etes...' : 'You are...'}
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          {fr ? 'Pour mieux vous orienter' : 'To better assist you'}
        </p>
        <div className="space-y-3 w-full">
          <button
            onClick={() => onSelect('student')}
            className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition text-sm"
          >
            {fr ? 'Etudiant INSEAD' : 'INSEAD Student'}
          </button>
          <button
            onClick={() => onSelect('landlord')}
            className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition text-sm"
          >
            {fr ? 'Proprietaire' : 'Landlord'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailInputView({
  fr,
  email,
  onEmailChange,
  onSubmit,
  onBack,
}: {
  fr: boolean;
  email: string;
  onEmailChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col p-5">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ChevronLeft className="w-4 h-4" />
        {fr ? 'Retour' : 'Back'}
      </button>

      <div className="flex-1 flex flex-col items-center justify-center">
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          {fr ? 'Votre email' : 'Your email'}
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          {fr ? 'Pour que nous puissions vous repondre' : 'So we can respond to you'}
        </p>
        <form onSubmit={onSubmit} className="w-full space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="email@example.com"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-400 focus:border-transparent text-sm"
            required
          />
          <button
            type="submit"
            className="w-full py-3 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition text-sm"
          >
            {fr ? 'Continuer' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

function MessagesView({
  fr,
  messages,
  newMessage,
  onNewMessageChange,
  onSend,
  loading,
  messagesEndRef,
  onBack,
}: {
  fr: boolean;
  messages: Message[];
  newMessage: string;
  onNewMessageChange: (v: string) => void;
  onSend: (e: React.FormEvent) => void;
  loading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onBack: () => void;
}) {
  return (
    <>
      <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2">
        <button onClick={onBack} className="p-1 hover:bg-gray-100 rounded-lg transition">
          <ChevronLeft className="w-4 h-4 text-gray-500" />
        </button>
        <span className="text-xs font-medium text-gray-500">Conversation</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center mt-12">
            <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <MessageCircle className="w-6 h-6 text-teal-500" />
            </div>
            <p className="font-semibold text-gray-900 text-sm">
              {fr ? 'Ecrivez-nous !' : 'Write to us!'}
            </p>
            <p className="text-xs text-gray-500 mt-1 px-6">
              {fr
                ? 'Notre equipe vous repondra dans les plus brefs delais.'
                : 'Our team will respond as soon as possible.'}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender_type === 'admin' && (
                <div className="w-7 h-7 bg-teal-600 rounded-full flex items-center justify-center text-white flex-shrink-0 mr-2 mt-1">
                  <Headphones className="w-3.5 h-3.5" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                  msg.sender_type === 'user'
                    ? 'bg-teal-600 text-white rounded-br-sm'
                    : 'bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                <p className={`text-[10px] mt-1 ${msg.sender_type === 'user' ? 'text-teal-200' : 'text-gray-400'}`}>
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

      <form onSubmit={onSend} className="p-3 bg-white border-t border-gray-100 sm:rounded-b-2xl">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => onNewMessageChange(e.target.value)}
            placeholder={fr ? 'Ecrivez votre message...' : 'Type your message...'}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-400 focus:border-transparent transition text-sm"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !newMessage.trim()}
            className="bg-teal-600 text-white p-2.5 rounded-xl hover:bg-teal-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </>
  );
}

function VisioView({
  fr,
  onBack,
}: {
  fr: boolean;
  onBack: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
        <button onClick={onBack} className="p-1 hover:bg-gray-100 rounded-lg transition">
          <ChevronLeft className="w-4 h-4 text-gray-500" />
        </button>
        <Video className="w-4 h-4 text-blue-500" />
        <span className="text-xs font-medium text-gray-700">
          {fr ? 'Prendre un RDV en visio' : 'Book a video call'}
        </span>
      </div>

      <div className="flex-1 overflow-hidden">
        <iframe
          src="https://calendly.com/ivan-sweeps/appel-decouverte-hellofonty"
          className="w-full h-full border-0"
          title={fr ? 'Prendre rendez-vous' : 'Book appointment'}
        />
      </div>
    </div>
  );
}
