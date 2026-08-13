import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import BackButton from '../components/BackButton';
import { Shield, Euro, Clock, CheckCircle, AlertTriangle, RotateCcw, X } from 'lucide-react';

interface DepositTransaction {
  id: string;
  booking_id: string;
  listing_id: string;
  landlord_id: string;
  student_id: string;
  deposit_amount: number;
  retained_amount: number;
  refunded_amount: number;
  retention_reason: string | null;
  status: 'collected' | 'refunding' | 'refunded' | 'retained';
  stripe_refund_id: string | null;
  collected_at: string;
  refunded_at: string | null;
  student: { first_name: string; last_name: string } | null;
  listing: { title: string } | null;
}

type Stats = {
  totalCollected: number;
  totalRefundable: number;
  totalRefunded: number;
  totalRetained: number;
};

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  collected: { label: 'Encaissée', color: 'bg-blue-100 text-blue-700', icon: Clock },
  refunding: { label: 'Remboursement en cours', color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
  refunded: { label: 'Remboursée', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  retained: { label: 'Retenue', color: 'bg-orange-100 text-orange-700', icon: Shield },
};

export default function LandlordDeposits() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [deposits, setDeposits] = useState<DepositTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ totalCollected: 0, totalRefundable: 0, totalRefunded: 0, totalRetained: 0 });
  const [refundModal, setRefundModal] = useState<DepositTransaction | null>(null);
  const [retainAmount, setRetainAmount] = useState('0');
  const [retainReason, setRetainReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (profile?.role !== 'landlord') {
      navigate('/dashboard');
      return;
    }
    fetchDeposits();
  }, [user, profile?.role, navigate]);

  async function fetchDeposits() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('deposit_transactions')
        .select(`
          id, booking_id, listing_id, landlord_id, student_id,
          deposit_amount, retained_amount, refunded_amount, retention_reason,
          status, stripe_refund_id, collected_at, refunded_at,
          student:profiles!student_id(first_name, last_name),
          listing:listings!listing_id(title)
        `)
        .eq('landlord_id', user.id)
        .order('collected_at', { ascending: false });

      if (error) throw error;

      const rows = (data || []) as unknown as DepositTransaction[];
      setDeposits(rows);

      setStats({
        totalCollected: rows.reduce((s, d) => s + d.deposit_amount, 0),
        totalRefundable: rows.filter(d => d.status === 'collected').reduce((s, d) => s + d.deposit_amount, 0),
        totalRefunded: rows.reduce((s, d) => s + d.refunded_amount, 0),
        totalRetained: rows.reduce((s, d) => s + d.retained_amount, 0),
      });
    } catch (err) {
      console.error('Error fetching deposits:', err);
    } finally {
      setLoading(false);
    }
  }

  function openRefundModal(deposit: DepositTransaction) {
    setRefundModal(deposit);
    setRetainAmount('0');
    setRetainReason('');
    setError(null);
    setSuccess(null);
  }

  function closeRefundModal() {
    setRefundModal(null);
    setRetainAmount('0');
    setRetainReason('');
    setError(null);
    setSuccess(null);
  }

  async function processRefund() {
    if (!refundModal) return;
    setProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const retain = parseFloat(retainAmount) || 0;
      if (retain < 0 || retain > refundModal.deposit_amount) {
        throw new Error('Le montant retenu doit être compris entre 0 et le montant de la caution');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-deposit-refund`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            deposit_id: refundModal.id,
            retained_amount: retain,
            retention_reason: retainReason || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Échec du remboursement');
      }

      setSuccess(`Caution remboursée avec succès. ${result.refunded_amount}€ remboursé à l'étudiant${result.retained_amount > 0 ? `, ${result.retained_amount}€ retenu` : ''}.`);
      await fetchDeposits();
      setTimeout(() => closeRefundModal(), 2000);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-rose-500 border-t-transparent"></div>
      </div>
    );
  }

  const refundAmount = refundModal ? refundModal.deposit_amount - (parseFloat(retainAmount) || 0) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-blue-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <BackButton />
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Shield className="h-8 w-8 text-rose-600" />
            Mes cautions
          </h1>
          <p className="text-gray-600 mt-1">Suivez et remboursez les cautions encaissées sur vos logements.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total encaissé</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalCollected.toFixed(2)} €</p>
              </div>
              <Euro className="w-10 h-10 text-blue-500 opacity-20" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">À rembourser</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{stats.totalRefundable.toFixed(2)} €</p>
              </div>
              <Clock className="w-10 h-10 text-orange-500 opacity-20" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Remboursé</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{stats.totalRefunded.toFixed(2)} €</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500 opacity-20" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Retenu</p>
                <p className="text-2xl font-bold text-rose-600 mt-1">{stats.totalRetained.toFixed(2)} €</p>
              </div>
              <Shield className="w-10 h-10 text-rose-500 opacity-20" />
            </div>
          </div>
        </div>

        {/* Deposits table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {deposits.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Aucune caution encaissée pour le moment.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Étudiant</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Logement</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Montant</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Encaissée le</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Détails</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {deposits.map((deposit) => {
                    const cfg = statusConfig[deposit.status];
                    const Icon = cfg.icon;
                    return (
                      <tr key={deposit.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-medium text-gray-900">
                            {deposit.student ? `${deposit.student.first_name} ${deposit.student.last_name}` : 'N/A'}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm text-gray-700">{deposit.listing?.title || 'N/A'}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm font-semibold text-gray-900">{deposit.deposit_amount.toFixed(2)} €</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm text-gray-600">
                            {new Date(deposit.collected_at).toLocaleDateString('fr-FR')}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          {deposit.status === 'retained' && (
                            <div className="text-xs text-gray-600">
                              <p>Retenu: {deposit.retained_amount.toFixed(2)} €</p>
                              <p>Remboursé: {deposit.refunded_amount.toFixed(2)} €</p>
                              {deposit.retention_reason && <p className="italic">"{deposit.retention_reason}"</p>}
                            </div>
                          )}
                          {deposit.status === 'refunded' && (
                            <p className="text-xs text-green-600">Remboursé le {deposit.refunded_at ? new Date(deposit.refunded_at).toLocaleDateString('fr-FR') : ''}</p>
                          )}
                          {deposit.status === 'collected' && (
                            <p className="text-xs text-gray-400">En attente de remboursement</p>
                          )}
                          {deposit.status === 'refunding' && (
                            <p className="text-xs text-yellow-600">Traitement en cours...</p>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {deposit.status === 'collected' && (
                            <button
                              onClick={() => openRefundModal(deposit)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Rembourser
                            </button>
                          )}
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

      {/* Refund Modal */}
      {refundModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Rembourser la caution</h2>
              <button onClick={closeRefundModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-1">
                <p className="text-sm text-gray-600">Étudiant: <span className="font-medium text-gray-900">{refundModal.student?.first_name} {refundModal.student?.last_name}</span></p>
                <p className="text-sm text-gray-600">Logement: <span className="font-medium text-gray-900">{refundModal.listing?.title}</span></p>
                <p className="text-sm text-gray-600">Caution: <span className="font-bold text-gray-900">{refundModal.deposit_amount.toFixed(2)} €</span></p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Montant à retenir (optionnel)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max={refundModal.deposit_amount}
                    step="0.01"
                    value={retainAmount}
                    onChange={(e) => setRetainAmount(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Laissez 0 pour un remboursement total.</p>
              </div>

              {parseFloat(retainAmount) > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motif de la retenue
                  </label>
                  <textarea
                    value={retainReason}
                    onChange={(e) => setRetainReason(e.target.value)}
                    rows={2}
                    placeholder="Ex: dégradations constatées..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
                  />
                </div>
              )}

              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Montant à rembourser à l'étudiant:</span>
                  <span className="font-bold text-green-600">{refundAmount.toFixed(2)} €</span>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-green-50 text-green-700 text-sm rounded-lg p-3">
                  {success}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={closeRefundModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  disabled={processing}
                >
                  Annuler
                </button>
                <button
                  onClick={processRefund}
                  disabled={processing || refundAmount <= 0}
                  className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Traitement...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      Rembourser
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
