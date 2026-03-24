import { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  Send,
  X,
  Minus,
  Video,
  Phone,
  ChevronLeft,
  Headphones,
  Clock,
  CheckCircle,
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

type Conversation = {
  id: string;
  status: string;
  last_message_at: string;
  user_email?: string;
  user_type?: string;
};

type ChatView = 'home' | 'type_selection' | 'email_input' | 'chat' | 'callback' | 'visio';

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
  const [callbackPhone, setCallbackPhone] = useState('');
  const [callbackSubmitted, setCallbackSubmitted] = useState(false);
  const [visioSubmitted, setVisioSubmitted] = useState(false);
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

  const handleCallbackRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callbackPhone.trim()) return;

    setLoading(true);
    try {
      let activeConvId = conversationId;
      if (!activeConvId) {
        if (user) {
          activeConvId = await createConversation();
        } else if (guestEmail) {
          activeConvId = await createConversation();
        }
      }

      if (activeConvId) {
        await supabase.from('support_messages').insert({
          conversation_id: activeConvId,
          sender_id: user?.id || null,
          sender_type: 'user',
          message: `[DEMANDE DE RAPPEL] Numero: ${callbackPhone}`,
        });

        await supabase
          .from('support_conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', activeConvId);
      }

      setCallbackSubmitted(true);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVisioRequest = async () => {
    setLoading(true);
    try {
      let activeConvId = conversationId;
      if (!activeConvId) {
        if (user) {
          activeConvId = await createConversation();
        }
      }

      if (activeConvId) {
        await supabase.from('support_messages').insert({
          conversation_id: activeConvId,
          sender_id: user?.id || null,
          sender_type: 'user',
          message: '[DEMANDE DE VISIO] Un utilisateur souhaite un rendez-vous en visio.',
        });

        await supabase
          .from('support_conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', activeConvId);
      }

      setVisioSubmitted(true);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fr = language === 'fr';

  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setIsOpen(true);
          setUnreadCount(0);
        }}
        className="fixed bottom-6 right-6 bg-gradient-to-br from-teal-500 to-teal-600 text-white p-4 rounded-full shadow-xl hover:shadow-2xl hover:from-teal-600 hover:to-teal-700 transition-all transform hover:scale-110 group"
        style={{ zIndex: 9999 }}
      >
        <Headphones className="w-6 h-6 group-hover:scale-110 transition-transform" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-bounce">
            {unreadCount}
          </span>
        )}
        <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {fr ? 'Besoin d\'aide ?' : 'Need help?'}
        </span>
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 w-[380px] bg-white rounded-2xl shadow-2xl flex flex-col transition-all duration-300 border border-gray-200 ${
        isMinimized ? 'h-[60px]' : 'h-[520px]'
      }`}
      style={{ zIndex: 9999 }}
    >
      <div
        className="bg-gradient-to-r from-teal-600 to-teal-700 text-white px-5 py-3.5 rounded-t-2xl flex items-center justify-between cursor-pointer"
        onClick={() => isMinimized && setIsMinimized(false)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{fr ? 'Support Hellofonty' : 'Hellofonty Support'}</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-400 rounded-full" />
              <span className="text-xs text-teal-100">{fr ? 'En ligne' : 'Online'}</span>
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
              onCallback={() => {
                if (user) setCurrentView('callback');
                else setCurrentView('type_selection');
              }}
              onVisio={() => {
                if (user) setCurrentView('visio');
                else setCurrentView('type_selection');
              }}
              hasExistingChat={!!conversationId}
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
            <ChatView
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

          {currentView === 'callback' && (
            <CallbackView
              fr={fr}
              phone={callbackPhone}
              onPhoneChange={setCallbackPhone}
              onSubmit={handleCallbackRequest}
              submitted={callbackSubmitted}
              loading={loading}
              onBack={() => { setCurrentView('home'); setCallbackSubmitted(false); }}
            />
          )}

          {currentView === 'visio' && (
            <VisioView
              fr={fr}
              onSubmit={handleVisioRequest}
              submitted={visioSubmitted}
              loading={loading}
              onBack={() => { setCurrentView('home'); setVisioSubmitted(false); }}
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
  onCallback,
  onVisio,
  hasExistingChat,
}: {
  fr: boolean;
  onStartChat: () => void;
  onCallback: () => void;
  onVisio: () => void;
  hasExistingChat: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col p-5 overflow-y-auto">
      <div className="text-center mb-5">
        <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Headphones className="w-7 h-7 text-teal-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900">
          {fr ? 'Comment pouvons-nous vous aider ?' : 'How can we help you?'}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {fr ? 'Choisissez une option ci-dessous' : 'Choose an option below'}
        </p>
      </div>

      <div className="space-y-3 flex-1">
        <button
          onClick={onStartChat}
          className="w-full flex items-center gap-4 p-4 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-all group text-left"
        >
          <div className="w-11 h-11 bg-teal-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 text-sm">
              {hasExistingChat
                ? (fr ? 'Reprendre la conversation' : 'Resume conversation')
                : (fr ? 'Discuter avec nous' : 'Chat with us')
              }
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {fr ? 'Reponse rapide par ecrit' : 'Quick written response'}
            </p>
          </div>
        </button>

        <button
          onClick={onVisio}
          className="w-full flex items-center gap-4 p-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-all group text-left"
        >
          <div className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 text-sm">
              {fr ? 'Prendre un RDV en visio' : 'Book a video call'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {fr ? 'Echangez en face a face avec notre equipe' : 'Talk face to face with our team'}
            </p>
          </div>
        </button>

        <button
          onClick={onCallback}
          className="w-full flex items-center gap-4 p-4 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all group text-left"
        >
          <div className="w-11 h-11 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <Phone className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 text-sm">
              {fr ? 'Etre rappele rapidement' : 'Get a callback'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {fr ? 'Nous vous rappelons sous 30 min' : 'We call you back within 30 min'}
            </p>
          </div>
        </button>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-400">
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

function ChatView({
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
        <span className="text-xs font-medium text-gray-500">{fr ? 'Conversation' : 'Conversation'}</span>
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

      <form onSubmit={onSend} className="p-3 bg-white border-t border-gray-100 rounded-b-2xl">
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

function CallbackView({
  fr,
  phone,
  onPhoneChange,
  onSubmit,
  submitted,
  loading,
  onBack,
}: {
  fr: boolean;
  phone: string;
  onPhoneChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitted: boolean;
  loading: boolean;
  onBack: () => void;
}) {
  if (submitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          {fr ? 'Demande envoyee !' : 'Request sent!'}
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          {fr
            ? 'Notre equipe vous rappellera dans les 30 prochaines minutes aux heures de bureau.'
            : 'Our team will call you back within 30 minutes during business hours.'}
        </p>
        <button
          onClick={onBack}
          className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition text-sm font-medium"
        >
          {fr ? 'Retour' : 'Back'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-5">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ChevronLeft className="w-4 h-4" />
        {fr ? 'Retour' : 'Back'}
      </button>

      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mb-4">
          <Phone className="w-7 h-7 text-amber-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          {fr ? 'Etre rappele' : 'Get a callback'}
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          {fr
            ? 'Laissez votre numero, nous vous rappelons sous 30 minutes.'
            : 'Leave your number, we\'ll call you back within 30 minutes.'}
        </p>

        <form onSubmit={onSubmit} className="w-full space-y-4">
          <input
            type="tel"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder={fr ? 'Votre numero de telephone' : 'Your phone number'}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm"
            required
          />
          <button
            type="submit"
            disabled={loading || !phone.trim()}
            className="w-full py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition text-sm disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                {fr ? 'Envoi...' : 'Sending...'}
              </span>
            ) : (
              fr ? 'Demander un rappel' : 'Request callback'
            )}
          </button>
        </form>

        <div className="flex items-center gap-2 mt-4 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span>{fr ? 'Lun-Ven, 9h-18h' : 'Mon-Fri, 9am-6pm'}</span>
        </div>
      </div>
    </div>
  );
}

function VisioView({
  fr,
  onSubmit,
  submitted,
  loading,
  onBack,
}: {
  fr: boolean;
  onSubmit: () => void;
  submitted: boolean;
  loading: boolean;
  onBack: () => void;
}) {
  if (submitted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          {fr ? 'Demande envoyee !' : 'Request sent!'}
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          {fr
            ? 'Notre equipe vous contactera pour planifier votre rendez-vous en visio.'
            : 'Our team will contact you to schedule your video appointment.'}
        </p>
        <button
          onClick={onBack}
          className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition text-sm font-medium"
        >
          {fr ? 'Retour' : 'Back'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-5">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ChevronLeft className="w-4 h-4" />
        {fr ? 'Retour' : 'Back'}
      </button>

      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
          <Video className="w-7 h-7 text-blue-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          {fr ? 'Rendez-vous en visio' : 'Video call appointment'}
        </h3>
        <p className="text-sm text-gray-500 mb-6 px-2">
          {fr
            ? 'Prenez rendez-vous avec notre equipe pour un echange en visio. Nous vous enverrons un lien de connexion par email.'
            : 'Book an appointment with our team for a video call. We\'ll send you a connection link by email.'}
        </p>

        <div className="w-full space-y-3 mb-6">
          <div className="flex items-center gap-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span>{fr ? 'Duree : 15-30 minutes' : 'Duration: 15-30 minutes'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            <Video className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span>{fr ? 'Via Google Meet ou Zoom' : 'Via Google Meet or Zoom'}</span>
          </div>
        </div>

        <button
          onClick={onSubmit}
          disabled={loading}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition text-sm disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              {fr ? 'Envoi...' : 'Sending...'}
            </span>
          ) : (
            fr ? 'Demander un rendez-vous' : 'Request appointment'
          )}
        </button>
      </div>
    </div>
  );
}
