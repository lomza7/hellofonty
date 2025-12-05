import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Copy, Plus, RefreshCw, Trash2, Check, X, ExternalLink, AlertCircle } from 'lucide-react';

interface ICalSyncManagerProps {
  listingId: string;
  listingTitle: string;
  onClose: () => void;
}

interface SyncToken {
  id: string;
  token: string;
  last_accessed_at: string | null;
  access_count: number;
}

interface ExternalFeed {
  id: string;
  feed_url: string;
  feed_name: string;
  last_synced_at: string | null;
  sync_status: 'active' | 'error' | 'disabled';
  error_message: string | null;
}

export default function ICalSyncManager({ listingId, listingTitle, onClose }: ICalSyncManagerProps) {
  const [syncToken, setSyncToken] = useState<SyncToken | null>(null);
  const [externalFeeds, setExternalFeeds] = useState<ExternalFeed[]>([]);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedName, setNewFeedName] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const exportUrl = syncToken
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ical?token=${syncToken.token}`
    : '';

  useEffect(() => {
    loadSyncData();
  }, [listingId]);

  async function loadSyncData() {
    try {
      setLoading(true);

      const { data: tokenData, error: tokenError } = await supabase
        .from('ical_sync_tokens')
        .select('*')
        .eq('listing_id', listingId)
        .maybeSingle();

      if (tokenError && tokenError.code !== 'PGRST116') {
        throw tokenError;
      }

      if (!tokenData) {
        const { data: newToken, error: createError } = await supabase
          .from('ical_sync_tokens')
          .insert({ listing_id: listingId })
          .select()
          .single();

        if (createError) throw createError;
        setSyncToken(newToken);
      } else {
        setSyncToken(tokenData);
      }

      const { data: feedsData, error: feedsError } = await supabase
        .from('external_ical_feeds')
        .select('*')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false });

      if (feedsError) throw feedsError;
      setExternalFeeds(feedsData || []);
    } catch (err: any) {
      console.error('Error loading sync data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(exportUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  async function addExternalFeed() {
    if (!newFeedUrl || !newFeedName) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    try {
      setSyncing(true);
      setError('');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non authentifié');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-external-ical`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            listingId,
            feedUrl: newFeedUrl,
            feedName: newFeedName,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Échec de l\'ajout du calendrier');
      }

      setNewFeedUrl('');
      setNewFeedName('');
      await loadSyncData();
    } catch (err: any) {
      console.error('Error adding feed:', err);
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function syncFeed(feedId: string) {
    try {
      setSyncing(true);
      setError('');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non authentifié');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-external-ical`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ feedId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Échec de la synchronisation');
      }

      await loadSyncData();
    } catch (err: any) {
      console.error('Error syncing feed:', err);
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function deleteFeed(feedId: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce calendrier ?')) return;

    try {
      const { error } = await supabase
        .from('external_ical_feeds')
        .delete()
        .eq('id', feedId);

      if (error) throw error;
      await loadSyncData();
    } catch (err: any) {
      console.error('Error deleting feed:', err);
      setError(err.message);
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return 'Jamais';
    return new Date(dateStr).toLocaleString('fr-FR');
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-8 max-w-2xl w-full">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg p-8 max-w-3xl w-full my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Synchronisation iCal
            </h2>
            <p className="text-gray-600">{listingTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Exporter vers Airbnb / Booking.com
            </h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-700 mb-3">
                Utilisez cette URL pour synchroniser vos dates bloquées HelloFonty avec d'autres plateformes :
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={exportUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm font-mono"
                />
                <button
                  onClick={copyToClipboard}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copié !' : 'Copier'}
                </button>
              </div>
              {syncToken?.last_accessed_at && (
                <p className="text-xs text-gray-600 mt-2">
                  Dernier accès : {formatDate(syncToken.last_accessed_at)} ({syncToken.access_count} téléchargements)
                </p>
              )}
            </div>

            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-2 text-sm">
                Instructions pour Airbnb :
              </h4>
              <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                <li>Allez dans votre calendrier Airbnb</li>
                <li>Cliquez sur "Disponibilité" puis "Synchroniser le calendrier"</li>
                <li>Collez l'URL ci-dessus et donnez un nom au calendrier</li>
              </ol>
              <h4 className="font-semibold text-gray-800 mb-2 text-sm mt-4">
                Instructions pour Booking.com :
              </h4>
              <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                <li>Allez dans "Calendrier et tarifs"</li>
                <li>Cliquez sur "Synchroniser les calendriers"</li>
                <li>Sélectionnez "Importer un calendrier" et collez l'URL</li>
              </ol>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <ExternalLink className="w-5 h-5" />
              Importer depuis Airbnb / Booking.com
            </h3>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-gray-800 mb-2 text-sm">
                Ajouter un calendrier externe
              </h4>
              <div className="space-y-3">
                <input
                  type="text"
                  value={newFeedName}
                  onChange={(e) => setNewFeedName(e.target.value)}
                  placeholder="Nom (ex: Airbnb, Booking.com)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="url"
                  value={newFeedUrl}
                  onChange={(e) => setNewFeedUrl(e.target.value)}
                  placeholder="URL du calendrier iCal"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                />
                <button
                  onClick={addExternalFeed}
                  disabled={syncing || !newFeedUrl || !newFeedName}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {syncing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Ajouter le calendrier
                </button>
              </div>
            </div>

            {externalFeeds.length > 0 ? (
              <div className="space-y-3">
                {externalFeeds.map((feed) => (
                  <div
                    key={feed.id}
                    className="border border-gray-200 rounded-lg p-4 bg-white"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-800">
                            {feed.feed_name}
                          </h4>
                          {feed.sync_status === 'active' && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                              Actif
                            </span>
                          )}
                          {feed.sync_status === 'error' && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">
                              Erreur
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-1 font-mono truncate">
                          {feed.feed_url}
                        </p>
                        {feed.last_synced_at && (
                          <p className="text-xs text-gray-500 mt-1">
                            Dernière sync : {formatDate(feed.last_synced_at)}
                          </p>
                        )}
                        {feed.error_message && (
                          <p className="text-xs text-red-600 mt-1">
                            {feed.error_message}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => syncFeed(feed.id)}
                          disabled={syncing}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
                          title="Synchroniser maintenant"
                        >
                          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          onClick={() => deleteFeed(feed.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Aucun calendrier externe configuré</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              <strong>Note :</strong> Les calendriers externes sont automatiquement synchronisés toutes les 30 minutes.
              Vous pouvez aussi synchroniser manuellement en cliquant sur l'icône de rafraîchissement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
