import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CheckCircle, RefreshCw, AlertCircle, ArrowLeft, Home } from 'lucide-react';
import StripeStatusBadge from '../components/StripeStatusBadge';
import type { StripeAccountStatusResponse } from '../types/stripe';

export default function PayoutsReturn() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [statusData, setStatusData] = useState<StripeAccountStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.role !== 'landlord') {
      navigate('/');
    }
  }, [profile, navigate]);

  const handleRefreshStatus = async () => {
    setLoading(true);
    setError(null);

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

      const data: StripeAccountStatusResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors de la récupération du statut');
      }

      setStatusData(data);
      await refreshProfile();
    } catch (err: any) {
      console.error('Erreur refresh statut:', err);
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const hasMissingRequirements = statusData?.status?.requirements && (
    statusData.status.requirements.currently_due.length > 0 ||
    statusData.status.requirements.past_due.length > 0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <CheckCircle className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Merci !</h1>
            <p className="text-lg text-gray-600">
              Vos informations ont été transmises à Stripe
            </p>
          </div>

          {!statusData && !error && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
              <p className="text-blue-900 text-center">
                Cliquez sur le bouton ci-dessous pour vérifier le statut de votre compte
              </p>
            </div>
          )}

          {statusData && statusData.status && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Statut actuel</h2>
                <StripeStatusBadge status={statusData.status.onboarding_status} />
              </div>

              {statusData.status.onboarding_status === 'complete' ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                  <div className="flex items-start">
                    <CheckCircle className="w-6 h-6 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-green-900 mb-1">Compte vérifié</h3>
                      <p className="text-sm text-green-700">
                        Félicitations ! Votre compte Stripe Connect est maintenant configuré et vérifié.
                        Vous pouvez recevoir des paiements de loyers.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                  <div className="flex items-start">
                    <AlertCircle className="w-6 h-6 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-yellow-900 mb-1">Vérification en cours</h3>
                      <p className="text-sm text-yellow-700 mb-3">
                        Stripe est en train de vérifier vos informations. Cela peut prendre quelques minutes
                        à quelques jours selon la complexité de votre dossier.
                      </p>
                      {hasMissingRequirements && (
                        <div className="mt-3">
                          <p className="text-sm font-medium text-yellow-900 mb-2">
                            Informations manquantes ou en attente :
                          </p>
                          <ul className="text-sm text-yellow-800 space-y-1">
                            {statusData.status.requirements.currently_due.map((req, idx) => (
                              <li key={idx} className="flex items-start">
                                <span className="mr-2">•</span>
                                <span>{req}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Erreur</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleRefreshStatus}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Vérification en cours...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Actualiser mon statut
                </>
              )}
            </button>

            <Link
              to="/proprietaire/paiements"
              className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour aux paiements
            </Link>

            <Link
              to="/"
              className="w-full text-center py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Retour à l'accueil
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
