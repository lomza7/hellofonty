import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Search, Send, CheckCircle, Clock, User, ArrowLeft } from 'lucide-react';
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
  unread_count: number;
  messages: Message[];
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
        .channel('admin-support-conversations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'support_conversations',
          },
          () => {
            loadConversations();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'support_messages',
          },
          () => {
            loadConversations();
            if (selectedConversation) {
              loadMessages(selectedConversation.id);
            }
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [profile, selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [selectedConversation?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
          let userEmail = conv.user_email || 'N/A';

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
            userName = conv.user_type === 'student' ? 'Étudiant (invité)' : 'Propriétaire (invité)';
            userEmail = conv.user_email;
          }

          const { data: messages } = await supabase
            .from('support_messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: true });

          const unreadCount =
            messages?.filter((m) => m.sender_type === 'user' && !m.read).length || 0;

          return {
            ...conv,
            user_name: userName,
            user_email: userEmail,
            unread_count: unreadCount,
            messages: messages || [],
          };
        })
      );

      setConversations(conversationsWithDetails);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setSelectedConversation((prev) =>
        prev ? { ...prev, messages: data || [] } : null
      );

      await supabase
        .from('support_messages')
        .update({ read: true })
        .eq('conversation_id', conversationId)
        .eq('sender_type', 'user')
        .eq('read', false);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const selectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    await loadMessages(conversation.id);

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

  const updateStatus = async (status: 'resolved' | 'closed') => {
    if (!selectedConversation) return;

    try {
      const { error } = await supabase
        .from('support_conversations')
        .update({ status })
        .eq('id', selectedConversation.id);

      if (error) throw error;

      setSelectedConversation((prev) => (prev ? { ...prev, status } : null));
      await loadConversations();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      conv.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.user_email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || conv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Accès refusé. Réservé aux administrateurs.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <BackButton />
          <div className="flex items-center gap-3">
            <MessageCircle className="w-8 h-8 text-rose-600" />
            <h1 className="text-3xl font-bold text-gray-900">Support Client</h1>
          </div>
          <p className="text-gray-600 mt-1">
            Gérez les demandes de support des utilisateurs
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              >
                <option value="all">Tous les statuts</option>
                <option value="open">Ouvert</option>
                <option value="in_progress">En cours</option>
                <option value="resolved">Résolu</option>
                <option value="closed">Fermé</option>
              </select>
            </div>

            <div className="overflow-y-auto max-h-[600px]">
              {filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`w-full p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left ${
                    selectedConversation?.id === conv.id ? 'bg-rose-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-rose-400 to-rose-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {conv.user_name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">
                          {conv.user_name}
                        </p>
                        <p className="text-xs text-gray-500">{conv.user_email}</p>
                      </div>
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        conv.status === 'open'
                          ? 'bg-blue-100 text-blue-800'
                          : conv.status === 'in_progress'
                          ? 'bg-yellow-100 text-yellow-800'
                          : conv.status === 'resolved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
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
                    <span className="text-xs text-gray-500">
                      {new Date(conv.last_message_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </button>
              ))}

              {filteredConversations.length === 0 && (
                <div className="p-8 text-center">
                  <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500">Aucune conversation</p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
            {selectedConversation ? (
              <>
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-rose-400 to-rose-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {selectedConversation.user_name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {selectedConversation.user_name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {selectedConversation.user_email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedConversation.status !== 'resolved' &&
                        selectedConversation.status !== 'closed' && (
                          <button
                            onClick={() => updateStatus('resolved')}
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition text-sm font-medium"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Marquer comme résolu
                          </button>
                        )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 max-h-[500px]">
                  {selectedConversation.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                          msg.sender_type === 'admin'
                            ? 'bg-rose-500 text-white rounded-br-none'
                            : 'bg-white text-gray-800 rounded-bl-none shadow-sm'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {msg.message}
                        </p>
                        <p
                          className={`text-xs mt-1 ${
                            msg.sender_type === 'admin'
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
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <form
                  onSubmit={sendMessage}
                  className="p-4 bg-white border-t rounded-b-xl"
                >
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Répondre au client..."
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
            ) : (
              <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">
                    Sélectionnez une conversation
                  </p>
                  <p className="text-gray-400 text-sm mt-2">
                    Choisissez une conversation pour commencer à répondre
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
