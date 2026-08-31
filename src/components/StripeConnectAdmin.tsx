import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw, AlertCircle, CheckCircle, ExternalLink, Search, X } from 'lucide-react';
import StripeStatusBadge from './StripeStatusBadge';
import type { Profile } from '../lib/supabase';
import type { StripeOnboardingStatus } from '../types/stripe';

interface LandlordStripeData extends Profile {
  listing_count?: number;
}

interface AccountRequirements {
  currently_due: string[];
  eventually_due: string[];
  past_due: string[];
  pending_verification: string[];
}

export default function StripeConnectAdmin() {
  const [landlords, setLandlords] = useState<LandlordStripeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StripeOnboardingStatus | 'all'>('all');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [selectedLandlord, setSelectedLandlord] = useState<LandlordStripeData | null>(null);
  const [requirements, setRequirements] = useState<AccountRequirements | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState<string | null>(null);

  useEffect(() => {
    loadLandlords();
  }, []);

  const loadLandlords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'landlord')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const landlordIds = data?.map(l => l.id) || [];

      const { data: listingCounts } = await supabase
        .from('listings')
        .select('landlord_id')
        .in('landlord_id', landlordIds);

      const countsMap = new Map<string, number>();
      listingCounts?.forEach(listing => {
        countsMap.set(listing.landlord_id, (countsMap.get(listing.landlord_id) || 0) + 1);
      });

      const enrichedData = data?.map(landlord => ({
        ...landlord,
        listing_count: countsMap.get(landlord.id) || 0,
      })) || [];

      setLandlords(enrichedData);
    } catch (error) {
      console.error('Erreur chargement propriétaires:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStatus = async (landlordId: string, stripeAccountId: string) => {
    setRefreshingId(landlordId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expirée');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-get-account-status`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ account_id: stripeAccountId, target_user_id: landlordId }),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (result.success) {
        await loadLandlords();
        if (selectedLandlord?.id === landlordId) {
          setRequirements(result.status?.requirements || null);
        }
      } else {
        console.error('Erreur refresh statut:', result.error || 'Réponse inattendue');
      }
    } catch (error) {
      console.error('Erreur refresh statut:', error);
    } finally {
      setRefreshingId(null);
    }
  };

  const handleViewDetails = async (landlord: LandlordStripeData) => {
    setSelectedLandlord(landlord);
    setRequirements(null);
    setDetailLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-get-account-status`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ account_id: landlord.stripe_account_id, target_user_id: landlord.id }),
        }
      );

      const result = await response.json().catch(() => ({}));
      if (result.success) {
        setRequirements(result.status?.requirements || null);
        await loadLandlords();
      }
    } catch (error) {
      console.error('Erreur détails:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleGenerateOnboardingLink = async (landlordId: string, stripeAccountId: string) => {
    setOnboardingLoading(landlordId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expirée');

      const origin = window.location.origin;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-create-onboarding-link`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accountId: null, origin }),
        }
      );

      const result = await response.json().catch(() => ({}));
      if (!result.success || !result.url) {
        throw new Error(result.error || 'Erreur lors de la génération du lien');
      }

      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Erreur lors de la génération du lien');
    } finally {
      setOnboardingLoading(null);
    }
  };

  const filteredLandlords = landlords.filter(landlord => {
    const matchesSearch = (
      `${landlord.first_name} ${landlord.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      landlord.stripe_account_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const status = landlord.stripe_onboarding_status || 'not_connected';
    const matchesStatus = statusFilter === 'all' || status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: landlords.length,
    not_connected: landlords.filter(l => !l.stripe_onboarding_status || l.stripe_onboarding_status === 'not_connected').length,
    pending: landlords.filter(l => l.stripe_onboarding_status === 'pending').length,
    complete: landlords.filter(l => l.stripe_onboarding_status === 'complete').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Gestion Stripe Connect</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Total propriétaires</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Non connectés</p>
            <p className="text-2xl font-bold text-red-600">{stats.not_connected}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">En cours</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Vérifiés</p>
            <p className="text-2xl font-bold text-green-600">{stats.complete}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom ou ID Stripe..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tous les statuts</option>
            <option value="not_connected">Non connecté</option>
            <option value="pending">En cours</option>
            <option value="complete">Vérifié</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Propriétaire
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Annonces
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stripe Account ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Paiements
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredLandlords.map((landlord) => (
              <tr key={landlord.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {landlord.first_name} {landlord.last_name}
                    </p>
                    <p className="text-xs text-gray-500">{landlord.id.slice(0, 8)}...</p>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900">{landlord.listing_count || 0}</span>
                </td>
                <td className="px-6 py-4">
                  {landlord.stripe_account_id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-600">
                        {landlord.stripe_account_id}
                      </span>
                      <a
                        href={`https://dashboard.stripe.com/connect/accounts/${landlord.stripe_account_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Non configuré</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StripeStatusBadge
                    status={landlord.stripe_onboarding_status || 'not_connected'}
                    size="sm"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    {landlord.stripe_payouts_enabled ? (
                      <div className="flex items-center text-green-600 text-xs">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Virements OK
                      </div>
                    ) : (
                      <div className="flex items-center text-gray-400 text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Virements NON
                      </div>
                    )}
                    {landlord.stripe_charges_enabled ? (
                      <div className="flex items-center text-green-600 text-xs">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Charges OK
                      </div>
                    ) : (
                      <div className="flex items-center text-gray-400 text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Charges NON
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center gap-3">
                    {landlord.stripe_account_id && (
                      <button
                        onClick={() => handleRefreshStatus(landlord.id, landlord.stripe_account_id!)}
                        disabled={refreshingId === landlord.id}
                        className="text-blue-600 hover:text-blue-700 disabled:opacity-50 flex items-center gap-1"
                        title="Synchroniser le statut depuis Stripe"
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${refreshingId === landlord.id ? 'animate-spin' : ''}`}
                        />
                        {refreshingId === landlord.id ? '...' : 'Actualiser'}
                      </button>
                    )}
                    {landlord.stripe_account_id && landlord.stripe_onboarding_status !== 'complete' && (
                      <button
                        onClick={() => handleGenerateOnboardingLink(landlord.id, landlord.stripe_account_id!)}
                        disabled={onboardingLoading === landlord.id}
                        className="text-amber-600 hover:text-amber-700 disabled:opacity-50 flex items-center gap-1"
                        title="Générer un lien d'onboarding Stripe"
                      >
                        {onboardingLoading === landlord.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <ExternalLink className="w-4 h-4" />
                        )}
                        Onboarding
                      </button>
                    )}
                    {landlord.stripe_account_id && (
                      <button
                        onClick={() => handleViewDetails(landlord)}
                        className="text-gray-600 hover:text-gray-800 flex items-center gap-1"
                        title="Voir les détails"
                      >
                        Détails
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredLandlords.length === 0 && (
        <div className="p-12 text-center">
          <p className="text-gray-500">Aucun propriétaire trouvé</p>
        </div>
      )}

      {/* Detail Modal */}
      {selectedLandlord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedLandlord(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedLandlord.first_name} {selectedLandlord.last_name}
                </h3>
                <p className="text-sm text-gray-500 font-mono mt-1">{selectedLandlord.stripe_account_id}</p>
              </div>
              <button
                onClick={() => setSelectedLandlord(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Status summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className={`rounded-lg p-3 ${selectedLandlord.stripe_details_submitted ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className="text-xs text-gray-600 mb-1">Informations</p>
                  <div className="flex items-center gap-1.5">
                    {selectedLandlord.stripe_details_submitted ? (
                      <><CheckCircle className="w-4 h-4 text-green-600" /><span className="text-sm font-medium text-green-700">Complètes</span></>
                    ) : (
                      <><AlertCircle className="w-4 h-4 text-red-600" /><span className="text-sm font-medium text-red-700">Manquantes</span></>
                    )}
                  </div>
                </div>
                <div className={`rounded-lg p-3 ${selectedLandlord.stripe_charges_enabled ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className="text-xs text-gray-600 mb-1">Prélèvements</p>
                  <div className="flex items-center gap-1.5">
                    {selectedLandlord.stripe_charges_enabled ? (
                      <><CheckCircle className="w-4 h-4 text-green-600" /><span className="text-sm font-medium text-green-700">Activés</span></>
                    ) : (
                      <><AlertCircle className="w-4 h-4 text-red-600" /><span className="text-sm font-medium text-red-700">Désactivés</span></>
                    )}
                  </div>
                </div>
                <div className={`rounded-lg p-3 ${selectedLandlord.stripe_payouts_enabled ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className="text-xs text-gray-600 mb-1">Virements</p>
                  <div className="flex items-center gap-1.5">
                    {selectedLandlord.stripe_payouts_enabled ? (
                      <><CheckCircle className="w-4 h-4 text-green-600" /><span className="text-sm font-medium text-green-700">Activés</span></>
                    ) : (
                      <><AlertCircle className="w-4 h-4 text-red-600" /><span className="text-sm font-medium text-red-700">Désactivés</span></>
                    )}
                  </div>
                </div>
              </div>

              {/* Requirements */}
              {detailLoading ? (
                <div className="flex items-center justify-center py-6">
                  <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
                </div>
              ) : requirements ? (
                <div className="space-y-3">
                  {requirements.past_due && requirements.past_due.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4" />
                        En retard ({requirements.past_due.length})
                      </p>
                      <ul className="text-xs text-red-700 space-y-1">
                        {requirements.past_due.map((req, i) => (
                          <li key={i} className="font-mono">{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {requirements.currently_due && requirements.currently_due.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <p className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4" />
                        À fournir maintenant ({requirements.currently_due.length})
                      </p>
                      <ul className="text-xs text-amber-700 space-y-1">
                        {requirements.currently_due.map((req, i) => (
                          <li key={i} className="font-mono">{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {requirements.eventually_due && requirements.eventually_due.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm font-semibold text-blue-800 mb-2">
                        À fournir plus tard ({requirements.eventually_due.length})
                      </p>
                      <ul className="text-xs text-blue-700 space-y-1">
                        {requirements.eventually_due.map((req, i) => (
                          <li key={i} className="font-mono">{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {requirements.pending_verification && requirements.pending_verification.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-sm font-semibold text-gray-700 mb-2">
                        En cours de vérification ({requirements.pending_verification.length})
                      </p>
                      <ul className="text-xs text-gray-600 space-y-1">
                        {requirements.pending_verification.map((req, i) => (
                          <li key={i} className="font-mono">{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(!requirements.past_due || requirements.past_due.length === 0) &&
                   (!requirements.currently_due || requirements.currently_due.length === 0) &&
                   (!requirements.eventually_due || requirements.eventually_due.length === 0) &&
                   (!requirements.pending_verification || requirements.pending_verification.length === 0) && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-green-800 flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4" />
                        Aucune information manquante. Le compte est complet.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-500 text-sm py-4">
                  Impossible de récupérer les détails. Cliquez sur « Actualiser » pour réessayer.
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleRefreshStatus(selectedLandlord.id, selectedLandlord.stripe_account_id!)}
                  disabled={refreshingId === selectedLandlord.id}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshingId === selectedLandlord.id ? 'animate-spin' : ''}`} />
                  Actualiser
                </button>
                {selectedLandlord.stripe_onboarding_status !== 'complete' && (
                  <button
                    onClick={() => handleGenerateOnboardingLink(selectedLandlord.id, selectedLandlord.stripe_account_id!)}
                    disabled={onboardingLoading === selectedLandlord.id}
                    className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {onboardingLoading === selectedLandlord.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ExternalLink className="w-4 h-4" />
                    )}
                    Relancer l'onboarding
                  </button>
                )}
                <a
                  href={`https://dashboard.stripe.com/connect/accounts/${selectedLandlord.stripe_account_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium flex items-center gap-1.5"
                >
                  <ExternalLink className="w-4 h-4" />
                  Stripe
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
