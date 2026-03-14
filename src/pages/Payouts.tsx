import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { CreditCard, AlertCircle, Info, ExternalLink, RefreshCw } from 'lucide-react';
import StripeStatusBadge from '../components/StripeStatusBadge';
import type { StripeOnboardingStatus } from '../types/stripe';
import BackButton from '../components/BackButton';

export default function Payouts() {
  const { user, profile, refreshProfile } = useAuth();
  const { language } = useLanguage();
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
      setError(err.message || (language === 'fr' ? 'Une erreur est survenue' : 'An error occurred'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusMessage = () => {
    const fr = language === 'fr';
    switch (stripeStatus) {
      case 'not_connected':
        return {
          title: fr ? 'Paiements non activés' : 'Payments not activated',
          description: fr ? "Vous n'avez pas encore configuré votre compte de paiement. Activez-le pour recevoir vos loyers directement sur votre compte bancaire." : "You haven't set up your payment account yet. Activate it to receive rent payments directly to your bank account.",
        };
      case 'pending':
        return {
          title: fr ? 'Configuration en cours' : 'Setup in progress',
          description: fr ? "Votre compte Stripe Connect est en cours de configuration. Complétez l'onboarding pour commencer à recevoir des paiements." : 'Your Stripe Connect account is being configured. Complete the onboarding to start receiving payments.',
        };
      case 'complete':
        return {
          title: fr ? 'Paiements activés' : 'Payments activated',
          description: fr ? 'Votre compte est configuré et vérifié. Vous pouvez maintenant recevoir des paiements de loyers.' : 'Your account is configured and verified. You can now receive rent payments.',
        };
      default:
        return {
          title: fr ? 'Statut inconnu' : 'Unknown status',
          description: fr ? 'Veuillez actualiser la page ou contacter le support.' : 'Please refresh the page or contact support.',
        };
    }
  };

  const statusMessage = getStatusMessage();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <BackButton />
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{language === 'fr' ? 'Gestion des Paiements' : 'Payment Management'}</h1>
          <p className="text-gray-600">
            {language === 'fr' ? 'Configurez votre compte Stripe Connect pour recevoir les paiements de loyers' : 'Set up your Stripe Connect account to receive rent payments'}
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
                <p className="text-sm font-medium text-red-800">{language === 'fr' ? 'Erreur' : 'Error'}</p>
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
                    {language === 'fr' ? 'Chargement...' : 'Loading...'}
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    {language === 'fr' ? 'Activer les paiements Stripe' : 'Activate Stripe payments'}
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
                    {language === 'fr' ? 'Chargement...' : 'Loading...'}
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-5 h-5" />
                    {language === 'fr' ? "Continuer l'onboarding" : 'Continue onboarding'}
                  </>
                )}
              </button>
            )}

            {stripeStatus === 'complete' && (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center">
                  <CreditCard className="w-6 h-6 text-green-600 mr-3" />
                  <div>
                    <p className="font-medium text-green-900">{language === 'fr' ? 'Compte vérifié' : 'Account verified'}</p>
                    <p className="text-sm text-green-700">{language === 'fr' ? 'Vous pouvez recevoir des paiements' : 'You can receive payments'}</p>
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
                      {language === 'fr' ? 'Chargement...' : 'Loading...'}
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4" />
                      {language === 'fr' ? 'Mettre à jour mes informations Stripe' : 'Update my Stripe information'}
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
              <h3 className="font-semibold text-blue-900 mb-2">{language === 'fr' ? 'Ce que Stripe va vous demander' : 'What Stripe will ask for'}</h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{language === 'fr' ? 'Vos informations personnelles (nom, prénom, date de naissance)' : 'Your personal information (name, date of birth)'}</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{language === 'fr' ? "Votre numéro d'identification fiscale (SIRET ou numéro de sécurité sociale)" : 'Your tax identification number (SIRET or social security number)'}</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{language === 'fr' ? 'Votre IBAN (compte bancaire pour recevoir les virements)' : 'Your IBAN (bank account to receive transfers)'}</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{language === 'fr' ? "Une pièce d'identité (carte d'identité ou passeport) pour vérification" : 'A photo ID (identity card or passport) for verification'}</span>
                </li>
              </ul>
              <p className="mt-4 text-sm text-blue-700 font-medium">
                {language === 'fr' ? 'La vérification prend généralement quelques minutes à quelques jours selon les informations fournies.' : 'Verification usually takes a few minutes to a few days depending on the information provided.'}
              </p>
            </div>
          </div>
        </div>

        {profile?.stripe_account_id && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              {language === 'fr' ? 'ID du compte Stripe :' : 'Stripe account ID:'} <span className="font-mono text-gray-700">{profile.stripe_account_id}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
