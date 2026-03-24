import { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  Search,
  Send,
  CheckCircle,
  Clock,
  User,
  Phone,
  Video,
  XCircle,
  Headphones,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import BackButton from '../components/BackButton';

type Message = {
  id: string;
  sender_type: 'user' | 'admin';
  sender_id: string;
  message: string;
  created_at: string;
  read: boolean;
};

type Conversation = {
  id: string;
  user_id: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  last_message_at: string;
  created_at: string;
  user_name?: string;
  user_email?: string;
  user_type?: string;
  unread_count: number;
  messages: Message[];
  last_message_preview?: string;
  has_callback_request?: boolean;
  has_visio_request?: boolean;
};

const STATUS_CONFIG = {
  open: { label: 'Nouveau', color: 'bg-blue-100 text-blue-700', dotColor: 'bg-blue-500' },
  in_progress: { label: 'En cours', color: 'bg-amber-100 text-amber-700', dotColor: 'bg-amber-500' },
  resolved: { label: 'Resolu', color: 'bg-green-100 text-green-700', dotColor: 'bg-green-500' },
  closed: { label: 'Ferme', color: 'bg-gray-100 text-gray-600', dotColor: 'bg-gray-400' },
};

export default function SupportAdmin() {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile?.role === 'admin') {
      loadConversations();
    }
  }, [profile]);

  useEffect(() => {
    if (profile?.role === 'admin') {
      const subscription = supabase
        .channel('admin-support-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations' }, () => {
          loadConversations();
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, (payload) => {
          loadConversations();
          if (selectedConversation && payload.new.conversation_id === selectedConversation.id) {
            setSelectedConversation((prev) => {
              if (!prev) return null;
              const newMsg = payload.new as Message;
              if (prev.messages.find(m => m.id === newMsg.id)) return prev;
              return { ...prev, messages: [...prev.messages, newMsg] };
            });
          }
        })
        .subscribe();

      return () => { subscription.unsubscribe(); };
    }
  }, [profile, selectedConversation?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConversation?.messages]);

  const loadConversations = async () => {
    try {
      const { data: convData, error: convError } = await supabase
        .from('support_conversations')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (convError) throw convError;

      const conversationsWithDetails = await Promise.all(
        (convData || []).map(async (conv) => {
          let userName = 'Utilisateur inconnu';
          let userEmail = conv.user_email || '';

          if (conv.user_id) {
            const { data: userData } = await supabase
              .from('profiles')
              .select('first_name, last_name, email')
              .eq('id', conv.user_id)
              .maybeSingle();

            if (userData) {
              userName = `${userData.first_name} ${userData.last_name}`;
              userEmail = userData.email;
            }
          } else if (conv.user_email) {
            userName = conv.user_type === 'student' ? 'Etudiant (invite)' : 'Proprietaire (invite)';
            userEmail = conv.user_email;
          }

          const { data: messages } = await supabase
            .from('support_messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: true });

          const unreadCount = messages?.filter((m) => m.sender_type === 'user' && !m.read).length || 0;
          const lastMsg = messages && messages.length > 0 ? messages[messages.length - 1] : null;
          const hasCallback = messages?.some(m => m.message.includes('[DEMANDE DE RAPPEL]')) || false;
          const hasVisio = messages?.some(m => m.message.includes('[DEMANDE DE VISIO]')) || false;

          return {
            ...conv,
            user_name: userName,
            user_email: userEmail,
            unread_count: unreadCount,
            messages: messages || [],
            last_message_preview: lastMsg?.message?.substring(0, 80) || '',
            has_callback_request: hasCallback,
            has_visio_request: hasVisio,
          };
        })
      );

      setConversations(conversationsWithDetails);

      if (selectedConversation) {
        const updated = conversationsWithDetails.find(c => c.id === selectedConversation.id);
        if (updated) setSelectedConversation(updated);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const selectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);

    await supabase
      .from('support_messages')
      .update({ read: true })
      .eq('conversation_id', conversation.id)
      .eq('sender_type', 'user')
      .eq('read', false);

    if (conversation.status === 'open') {
      await supabase
        .from('support_conversations')
        .update({ status: 'in_progress', assigned_admin_id: user?.id })
        .eq('id', conversation.id);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation || !user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('support_messages').insert({
        conversation_id: selectedConversation.id,
        sender_id: user.id,
        sender_type: 'admin',
        message: newMessage.trim(),
      });

      if (error) throw error;

      await supabase
        .from('support_conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', selectedConversation.id);

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (status: 'resolved' | 'closed' | 'in_progress') => {
    if (!selectedConversation) return;
    try {
      await supabase
        .from('support_conversations')
        .update({ status })
        .eq('id', selectedConversation.id);

      setSelectedConversation((prev) => (prev ? { ...prev, status } : null));
      await loadConversations();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      !searchTerm ||
      conv.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.last_message_preview?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || conv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openCount = conversations.filter(c => c.status === 'open').length;
  const inProgressCount = conversations.filter(c => c.status === 'in_progress').length;
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Acces refuse. Reserve aux administrateurs.</p>
      </div>
    );
  }

  const formatMessageForDisplay = (message: string) => {
    if (message.includes('[DEMANDE DE RAPPEL]')) {
      const phone = message.replace('[DEMANDE DE RAPPEL] Numero: ', '');
      return { type: 'callback' as const, phone };
    }
    if (message.includes('[DEMANDE DE VISIO]')) {
      return { type: 'visio' as const };
    }
    return { type: 'text' as const, text: message };
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <BackButton />

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
              <Headphones className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Support Client</h1>
              <p className="text-sm text-gray-500">Gerez les demandes de support</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {openCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                <AlertCircle className="w-4 h-4" />
                {openCount} nouveau{openCount > 1 ? 'x' : ''}
              </div>
            )}
            {totalUnread > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                <MessageCircle className="w-4 h-4" />
                {totalUnread} non lu{totalUnread > 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-200px)]">
          <div className="lg:col-span-4 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-100 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {[
                  { key: 'all', label: 'Tous', count: conversations.length },
                  { key: 'open', label: 'Nouveaux', count: openCount },
                  { key: 'in_progress', label: 'En cours', count: inProgressCount },
                  { key: 'resolved', label: 'Resolus', count: conversations.filter(c => c.status === 'resolved').length },
                ].map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      statusFilter === key
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {label} ({count})
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredConversations.map((conv) => {
                const statusCfg = STATUS_CONFIG[conv.status];
                return (
                  <button
                    key={conv.id}
                    onClick={() => selectConversation(conv)}
                    className={`w-full p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors text-left ${
                      selectedConversation?.id === conv.id ? 'bg-teal-50 border-l-2 border-l-teal-500' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 relative">
                        {conv.user_name?.charAt(0).toUpperCase() || 'U'}
                        {conv.unread_count > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-semibold text-gray-900 text-sm truncate">{conv.user_name}</span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                            {new Date(conv.last_message_at).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate mb-1.5">{conv.user_email}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                          {conv.has_callback_request && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                              <Phone className="w-2.5 h-2.5" /> Rappel
                            </span>
                          )}
                          {conv.has_visio_request && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                              <Video className="w-2.5 h-2.5" /> Visio
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {filteredConversations.length === 0 && (
                <div className="p-8 text-center">
                  <MessageCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Aucune conversation</p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-8 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
            {selectedConversation ? (
              <>
                <div className="px-5 py-3 border-b border-gray-100 bg-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {selectedConversation.user_name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">{selectedConversation.user_name}</h3>
                      <p className="text-xs text-gray-500">{selectedConversation.user_email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedConversation.status !== 'resolved' && selectedConversation.status !== 'closed' && (
                      <button
                        onClick={() => updateStatus('resolved')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition text-xs font-medium"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Resolu
                      </button>
                    )}
                    {selectedConversation.status === 'resolved' && (
                      <>
                        <button
                          onClick={() => updateStatus('in_progress')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition text-xs font-medium"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Reouvrir
                        </button>
                        <button
                          onClick={() => updateStatus('closed')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100 transition text-xs font-medium"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Fermer
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-gray-50">
                  {selectedConversation.messages.map((msg) => {
                    const parsed = formatMessageForDisplay(msg.message);
                    const isAdmin = msg.sender_type === 'admin';

                    if (parsed.type === 'callback') {
                      return (
                        <div key={msg.id} className="flex justify-start">
                          <div className="max-w-[80%] bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Phone className="w-4 h-4 text-amber-600" />
                              <span className="text-xs font-semibold text-amber-700">Demande de rappel</span>
                            </div>
                            <p className="text-sm font-medium text-gray-900">{parsed.phone}</p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    if (parsed.type === 'visio') {
                      return (
                        <div key={msg.id} className="flex justify-start">
                          <div className="max-w-[80%] bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Video className="w-4 h-4 text-blue-600" />
                              <span className="text-xs font-semibold text-blue-700">Demande de visio</span>
                            </div>
                            <p className="text-sm text-gray-700">L'utilisateur souhaite un rendez-vous en visio.</p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                        {!isAdmin && (
                          <div className="w-7 h-7 bg-teal-600 rounded-full flex items-center justify-center text-white flex-shrink-0 mr-2 mt-1 text-[10px] font-bold">
                            {selectedConversation.user_name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                        )}
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                            isAdmin
                              ? 'bg-teal-600 text-white rounded-br-sm'
                              : 'bg-white text-gray-800 rounded-bl-sm shadow-sm border border-gray-100'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                          <div className={`flex items-center gap-1 mt-1 ${isAdmin ? 'justify-end' : ''}`}>
                            <p className={`text-[10px] ${isAdmin ? 'text-teal-200' : 'text-gray-400'}`}>
                              {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {isAdmin && msg.read && <CheckCircle className="w-3 h-3 text-teal-200" />}
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center ml-2 mt-1">
                            <User className="w-3.5 h-3.5 text-gray-500" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {selectedConversation.status !== 'closed' && (
                  <form onSubmit={sendMessage} className="p-4 bg-white border-t border-gray-100">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Repondre au client..."
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-400 focus:border-transparent transition text-sm"
                        disabled={loading}
                      />
                      <button
                        type="submit"
                        disabled={loading || !newMessage.trim()}
                        className="bg-teal-600 text-white px-4 py-2.5 rounded-xl hover:bg-teal-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        <span className="text-sm font-medium hidden sm:block">Envoyer</span>
                      </button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">Selectionnez une conversation</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Choisissez une conversation a gauche pour commencer
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
