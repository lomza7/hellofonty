import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CreditCard, AlertCircle, Info, ExternalLink, RefreshCw } from 'lucide-react';
import StripeStatusBadge from '../components/StripeStatusBadge';
import type { StripeOnboardingStatus } from '../types/stripe';

export default function Payouts() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeStatus, setStripeStatus] = useState<StripeOnboardingStatus>('not_connected');

  useEffect(() => {
    if (profile?.role !== 'landlord') {
      navigate('/');
      return;
    }

    if (profile) {
      setStripeStatus(profile.stripe_onboarding_status || 'not_connected');
    }
  }, [profile, navigate]);

  const handleActivatePayments = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expirée');

      let accountId = profile?.stripe_account_id;

      if (!accountId) {
        const createResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-create-landlord-account`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const createData = await createResponse.json();

        if (!createData.success) {
          throw new Error(createData.error || 'Erreur lors de la création du compte Stripe');
        }

        accountId = createData.accountId;
        await refreshProfile();
      }

      const linkResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-create-onboarding-link`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accountId }),
        }
      );

      const linkData = await linkResponse.json();

      if (!linkData.success || !linkData.url) {
        throw new Error(linkData.error || 'Erreur lors de la génération du lien d\'onboarding');
      }

      window.location.href = linkData.url;
    } catch (err: any) {
      console.error('Erreur activation paiements:', err);
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const getStatusMessage = () => {
    switch (stripeStatus) {
      case 'not_connected':
        return {
          title: 'Paiements non activés',
          description: 'Vous n\'avez pas encore configuré votre compte de paiement. Activez-le pour recevoir vos loyers directement sur votre compte bancaire.',
        };
      case 'pending':
        return {
          title: 'Configuration en cours',
          description: 'Votre compte Stripe Connect est en cours de configuration. Complétez l\'onboarding pour commencer à recevoir des paiements.',
        };
      case 'complete':
        return {
          title: 'Paiements activés',
          description: 'Votre compte est configuré et vérifié. Vous pouvez maintenant recevoir des paiements de loyers.',
        };
      default:
        return {
          title: 'Statut inconnu',
          description: 'Veuillez actualiser la page ou contacter le support.',
        };
    }
  };

  const statusMessage = getStatusMessage();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestion des Paiements</h1>
          <p className="text-gray-600">
            Configurez votre compte Stripe Connect pour recevoir les paiements de loyers
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{statusMessage.title}</h2>
              <p className="text-gray-600">{statusMessage.description}</p>
            </div>
            <StripeStatusBadge status={stripeStatus} size="lg" />
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Erreur</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {stripeStatus === 'not_connected' && (
              <button
                onClick={handleActivatePayments}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Chargement...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    Activer les paiements Stripe
                  </>
                )}
              </button>
            )}

            {stripeStatus === 'pending' && (
              <button
                onClick={handleActivatePayments}
                disabled={loading}
                className="w-full bg-yellow-600 text-white py-4 px-6 rounded-xl font-semibold hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Chargement...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-5 h-5" />
                    Continuer l'onboarding
                  </>
                )}
              </button>
            )}

            {stripeStatus === 'complete' && (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center">
                  <CreditCard className="w-6 h-6 text-green-600 mr-3" />
                  <div>
                    <p className="font-medium text-green-900">Compte vérifié</p>
                    <p className="text-sm text-green-700">Vous pouvez recevoir des paiements</p>
                  </div>
                </div>
                <button
                  onClick={handleActivatePayments}
                  disabled={loading}
                  className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Chargement...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4" />
                      Mettre à jour mes informations Stripe
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
          <div className="flex items-start">
            <Info className="w-6 h-6 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Ce que Stripe va vous demander</h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Vos informations personnelles (nom, prénom, date de naissance)</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Votre numéro d'identification fiscale (SIRET ou numéro de sécurité sociale)</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Votre IBAN (compte bancaire pour recevoir les virements)</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Une pièce d'identité (carte d'identité ou passeport) pour vérification</span>
                </li>
              </ul>
              <p className="mt-4 text-sm text-blue-700 font-medium">
                La vérification prend généralement quelques minutes à quelques jours selon les informations fournies.
              </p>
            </div>
          </div>
        </div>

        {profile?.stripe_account_id && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              ID du compte Stripe : <span className="font-mono text-gray-700">{profile.stripe_account_id}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
