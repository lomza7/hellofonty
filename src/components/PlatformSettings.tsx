import { useState, useEffect } from 'react';
import { Euro, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Setting = {
  id: string;
  setting_key: string;
  setting_value: string;
  description: string;
};

export default function PlatformSettings() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [platformFeeAmount, setPlatformFeeAmount] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('platform_settings')
        .select('*')
        .in('setting_key', ['platform_fee_amount']);

      if (fetchError) throw fetchError;

      if (data) {
        setSettings(data);

        const feeAmount = data.find(s => s.setting_key === 'platform_fee_amount');

        setPlatformFeeAmount(feeAmount?.setting_value || '390');
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement des paramètres:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const feeAmountValue = parseFloat(platformFeeAmount);

      if (isNaN(feeAmountValue) || feeAmountValue < 0) {
        throw new Error('Les frais de plateforme doivent être un nombre positif');
      }

      const { error: updateError } = await supabase
        .from('platform_settings')
        .update({ setting_value: platformFeeAmount })
        .eq('setting_key', 'platform_fee_amount');

      if (updateError) throw updateError;

      setSuccess('Paramètres sauvegardés avec succès');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Erreur lors de la sauvegarde:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des paramètres...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center">
            <Euro className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Paramètres de la plateforme</h2>
            <p className="text-gray-600 text-sm">Configurez les frais et commissions de la plateforme</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-900 font-medium">Erreur</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-green-900 font-medium">Succès</p>
              <p className="text-green-700 text-sm">{success}</p>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Euro className="w-5 h-5 text-purple-600" />
            Frais de plateforme
          </h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Montant fixe prélevé par réservation (en euros)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.01"
                value={platformFeeAmount}
                onChange={(e) => setPlatformFeeAmount(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent text-lg font-semibold"
                placeholder="390"
              />
              <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">
                €
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Ce montant fixe est prélevé par la plateforme lors du paiement via Stripe.
              Le reste est transféré au propriétaire.
            </p>
          </div>

          <div className="bg-white rounded-lg p-4 border border-purple-200">
            <p className="text-sm text-purple-900 font-medium mb-2">💡 Répartition du paiement</p>
            <div className="text-sm text-gray-700 space-y-1">
              {(() => {
                const total = 850;
                const platformFee = parseFloat(platformFeeAmount || '390');
                const landlordAmount = total - platformFee;

                return (
                  <>
                    <div className="flex justify-between">
                      <span>Montant total payé</span>
                      <span className="font-semibold">{total.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between text-purple-700">
                      <span>Frais de plateforme (fixe)</span>
                      <span className="font-bold">{platformFee.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between text-green-700 pt-2 border-t border-gray-200">
                      <span>Transféré au propriétaire</span>
                      <span className="font-bold">{landlordAmount.toFixed(2)} €</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-rose-600 to-pink-600 text-white font-bold rounded-lg hover:from-rose-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Sauvegarde...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Sauvegarder les paramètres</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
