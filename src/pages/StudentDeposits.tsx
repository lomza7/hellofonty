import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import BackButton from '../components/BackButton';
import { Shield, Clock, CheckCircle, AlertTriangle, Euro, AlertCircle } from 'lucide-react';

interface DepositTransaction {
  id: string;
  deposit_amount: number;
  retained_amount: number;
  refunded_amount: number;
  retention_reason: string | null;
  status: 'collected' | 'refunding' | 'refunded' | 'retained';
  collected_at: string;
  refunded_at: string | null;
  listing: { title: string } | null;
  landlord: { first_name: string; last_name: string } | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  collected: { label: 'Encaissée', color: 'bg-blue-100 text-blue-700', icon: Clock },
  refunding: { label: 'Remboursement en cours', color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
  refunded: { label: 'Remboursée', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  retained: { label: 'Partiellement retenue', color: 'bg-orange-100 text-orange-700', icon: Shield },
};

export default function StudentDeposits() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [deposits, setDeposits] = useState<DepositTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (profile?.role !== 'student') {
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
          id, deposit_amount, retained_amount, refunded_amount, retention_reason,
          status, collected_at, refunded_at,
          listing:listings!listing_id(title),
          landlord:profiles!landlord_id(first_name, last_name)
        `)
        .eq('student_id', user.id)
        .order('collected_at', { ascending: false });

      if (error) throw error;
      setDeposits((data || []) as unknown as DepositTransaction[]);
    } catch (err) {
      console.error('Error fetching deposits:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-rose-500 border-t-transparent"></div>
      </div>
    );
  }

  const totalCollected = deposits.reduce((s, d) => s + d.deposit_amount, 0);
  const totalRefunded = deposits.reduce((s, d) => s + d.refunded_amount, 0);
  const totalRetained = deposits.reduce((s, d) => s + d.retained_amount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-blue-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <BackButton />
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Shield className="h-8 w-8 text-rose-600" />
            Mes cautions
          </h1>
          <p className="text-gray-600 mt-1">Suivez le statut de vos cautions versées auprès des propriétaires.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total versé</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{totalCollected.toFixed(2)} €</p>
              </div>
              <Euro className="w-10 h-10 text-blue-500 opacity-20" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Remboursé</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{totalRefunded.toFixed(2)} €</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500 opacity-20" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Retenu</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{totalRetained.toFixed(2)} €</p>
              </div>
              <Shield className="w-10 h-10 text-orange-500 opacity-20" />
            </div>
          </div>
        </div>

        {/* Deposits list */}
        {deposits.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500 border border-gray-200">
            <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Aucune caution enregistrée pour le moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {deposits.map((deposit) => {
              const cfg = statusConfig[deposit.status] || { label: deposit.status, color: 'bg-gray-100 text-gray-700', icon: AlertCircle };
              const Icon = cfg.icon;
              return (
                <div key={deposit.id} className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{deposit.listing?.title || 'Logement'}</h3>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Propriétaire: {deposit.landlord ? `${deposit.landlord.first_name} ${deposit.landlord.last_name}` : 'N/A'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Encaissée le {new Date(deposit.collected_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{Number(deposit.deposit_amount || 0).toFixed(2)} €</p>
                      {deposit.status === 'refunded' && deposit.refunded_at && (
                        <p className="text-xs text-green-600">Remboursé le {new Date(deposit.refunded_at).toLocaleDateString('fr-FR')}</p>
                      )}
                      {deposit.status === 'refunding' && (
                        <p className="text-xs text-yellow-600">Traitement en cours...</p>
                      )}
                    </div>
                  </div>

                  {deposit.status === 'retained' && (
                    <div className="mt-3 pt-3 border-t border-gray-100 bg-orange-50 -mx-5 -mb-5 px-5 pb-4 rounded-b-xl">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Remboursé</p>
                          <p className="font-semibold text-green-600">{Number(deposit.refunded_amount || 0).toFixed(2)} €</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Retenu</p>
                          <p className="font-semibold text-orange-600">{Number(deposit.retained_amount || 0).toFixed(2)} €</p>
                        </div>
                      </div>
                      {deposit.retention_reason && (
                        <p className="text-xs text-gray-600 mt-2 italic">Motif: "{deposit.retention_reason}"</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
