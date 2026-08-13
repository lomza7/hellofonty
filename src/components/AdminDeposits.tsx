import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Euro, Clock, CheckCircle, AlertTriangle, Search } from 'lucide-react';

interface DepositRow {
  id: string;
  deposit_amount: number;
  retained_amount: number;
  refunded_amount: number;
  retention_reason: string | null;
  status: 'collected' | 'refunding' | 'refunded' | 'retained';
  collected_at: string;
  refunded_at: string | null;
  student: { first_name: string; last_name: string } | null;
  landlord: { first_name: string; last_name: string } | null;
  listing: { title: string } | null;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  collected: { label: 'Encaissée', color: 'bg-blue-100 text-blue-700' },
  refunding: { label: 'En cours', color: 'bg-yellow-100 text-yellow-700' },
  refunded: { label: 'Remboursée', color: 'bg-green-100 text-green-700' },
  retained: { label: 'Retenue', color: 'bg-orange-100 text-orange-700' },
};

export default function AdminDeposits() {
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchDeposits();
  }, []);

  async function fetchDeposits() {
    try {
      const { data, error } = await supabase
        .from('deposit_transactions')
        .select(`
          id, deposit_amount, retained_amount, refunded_amount, retention_reason,
          status, collected_at, refunded_at,
          student:profiles!student_id(first_name, last_name),
          landlord:profiles!landlord_id(first_name, last_name),
          listing:listings!listing_id(title)
        `)
        .order('collected_at', { ascending: false });

      if (error) throw error;
      setDeposits((data || []) as unknown as DepositRow[]);
    } catch (err) {
      console.error('Error fetching deposits:', err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = deposits.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = d.student ? `${d.student.first_name} ${d.student.last_name}`.toLowerCase() : '';
      const landlord = d.landlord ? `${d.landlord.first_name} ${d.landlord.last_name}`.toLowerCase() : '';
      const title = d.listing?.title?.toLowerCase() ?? '';
      return name.includes(q) || landlord.includes(q) || title.includes(q);
    }
    return true;
  });

  const totalCollected = deposits.reduce((s, d) => s + d.deposit_amount, 0);
  const totalRefunded = deposits.reduce((s, d) => s + d.refunded_amount, 0);
  const totalRefundable = deposits.filter(d => d.status === 'collected').reduce((s, d) => s + d.deposit_amount, 0);
  const totalRetained = deposits.reduce((s, d) => s + d.retained_amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-rose-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <Shield className="w-6 h-6 text-rose-600" />
        Cautions (consultation)
      </h2>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total encaissé</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{totalCollected.toFixed(2)} €</p>
            </div>
            <Euro className="w-8 h-8 text-blue-500 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">À rembourser</p>
              <p className="text-xl font-bold text-orange-600 mt-1">{totalRefundable.toFixed(2)} €</p>
            </div>
            <Clock className="w-8 h-8 text-orange-500 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Remboursé</p>
              <p className="text-xl font-bold text-green-600 mt-1">{totalRefunded.toFixed(2)} €</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500 opacity-20" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Retenu</p>
              <p className="text-xl font-bold text-rose-600 mt-1">{totalRetained.toFixed(2)} €</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-rose-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par étudiant, propriétaire ou logement..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
        >
          <option value="all">Tous les statuts</option>
          <option value="collected">Encaissée</option>
          <option value="refunding">En cours</option>
          <option value="refunded">Remboursée</option>
          <option value="retained">Retenue</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Aucune caution trouvée.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Étudiant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Propriétaire</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Logement</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Détails</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map(d => {
                  const cfg = statusConfig[d.status];
                  return (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {d.student ? `${d.student.first_name} ${d.student.last_name}` : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {d.landlord ? `${d.landlord.first_name} ${d.landlord.last_name}` : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{d.listing?.title ?? 'N/A'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{d.deposit_amount.toFixed(2)} €</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {d.status === 'retained' && (
                          <div>
                            <p>Retenu: {d.retained_amount.toFixed(2)}€</p>
                            <p>Remboursé: {d.refunded_amount.toFixed(2)}€</p>
                            {d.retention_reason && <p className="italic">"{d.retention_reason}"</p>}
                          </div>
                        )}
                        {d.status === 'refunded' && <p>Remboursé le {d.refunded_at ? new Date(d.refunded_at).toLocaleDateString('fr-FR') : ''}</p>}
                        {d.status === 'collected' && <p className="text-gray-400">En attente</p>}
                        {d.status === 'refunding' && <p className="text-yellow-600">En cours...</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(d.collected_at).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
