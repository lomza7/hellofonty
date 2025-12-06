import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw, AlertCircle, CheckCircle, Clock, ExternalLink, Search } from 'lucide-react';
import StripeStatusBadge from './StripeStatusBadge';
import type { Profile } from '../lib/supabase';
import type { StripeOnboardingStatus } from '../types/stripe';

interface LandlordStripeData extends Profile {
  listing_count?: number;
}

export default function StripeConnectAdmin() {
  const [landlords, setLandlords] = useState<LandlordStripeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StripeOnboardingStatus | 'all'>('all');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

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
        }
      );

      const result = await response.json();

      if (result.success) {
        await loadLandlords();
      }
    } catch (error) {
      console.error('Erreur refresh statut:', error);
    } finally {
      setRefreshingId(null);
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
                  {landlord.stripe_account_id && (
                    <button
                      onClick={() => handleRefreshStatus(landlord.id, landlord.stripe_account_id!)}
                      disabled={refreshingId === landlord.id}
                      className="text-blue-600 hover:text-blue-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${refreshingId === landlord.id ? 'animate-spin' : ''}`}
                      />
                      {refreshingId === landlord.id ? 'Refresh...' : 'Actualiser'}
                    </button>
                  )}
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
    </div>
  );
}
