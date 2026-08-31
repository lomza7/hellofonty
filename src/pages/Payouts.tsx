import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { CreditCard, AlertCircle, Info, ExternalLink, RefreshCw, X, Plus, Trash2, Star, Building2, CheckCircle, Clock } from 'lucide-react';
import StripeStatusBadge from '../components/StripeStatusBadge';
import type { StripeOnboardingStatus } from '../types/stripe';
import BackButton from '../components/BackButton';

interface StripeAccount {
  id: string;
  stripe_account_id: string;
  label: string;
  is_default: boolean;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  stripe_details_submitted: boolean;
  stripe_onboarding_status: string;
  stripe_onboarding_updated_at: string | null;
  created_at: string;
}

export default function Payouts() {
  const { user, profile, refreshProfile } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeStatus, setStripeStatus] = useState<StripeOnboardingStatus>('not_connected');
  const [showMigrationNotice, setShowMigrationNotice] = useState(false);
  const [accounts, setAccounts] = useState<StripeAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAccountLabel, setNewAccountLabel] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [onboardingAccountId, setOnboardingAccountId] = useState<string | null>(null);

  const hasSyncedRef = useRef(false);

  const fetchAccounts = useCallback(async () => {
    if (!user) return;
    setAccountsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-manage-landlord-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'list' }),
        }
      );

      const data = await response.json();
      if (data.success && data.accounts) {
        setAccounts(data.accounts);
        const defaultAccount = data.accounts.find((a: StripeAccount) => a.is_default);
        if (defaultAccount) {
          setStripeStatus(defaultAccount.stripe_onboarding_status || 'not_connected');
        }
      }
    } catch (err) {
      console.error('Error fetching accounts:', err);
    } finally {
      setAccountsLoading(false);
    }
  }, [user]);

  const syncStripeStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-manage-landlord-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'sync_status' }),
        }
      );

      const data = await response.json();
      if (data.success && data.accounts) {
        setAccounts(data.accounts);
        const defaultAccount = data.accounts.find((a: StripeAccount) => a.is_default);
        const newStatus = defaultAccount?.stripe_onboarding_status || 'not_connected';

        setStripeStatus((prev) => (prev !== newStatus ? newStatus : prev));

        if (profile?.stripe_onboarding_status !== newStatus) {
          await refreshProfile();
        }
      }
    } catch (err) {
      console.error('Error syncing Stripe status:', err);
    }
  }, [profile?.stripe_onboarding_status, refreshProfile]);

  useEffect(() => {
    if (profile && profile.role !== 'landlord') {
      navigate('/');
      return;
    }
  }, [profile, navigate]);

  useEffect(() => {
    if (!profile || profile.role !== 'landlord') return;
    if (hasSyncedRef.current) return;
    hasSyncedRef.current = true;

    setStripeStatus(profile.stripe_onboarding_status || 'not_connected');

    if ((profile as any).stripe_migration_needed) {
      setShowMigrationNotice(true);
    }

    syncStripeStatus();
    fetchAccounts();
  }, [profile, syncStripeStatus, fetchAccounts]);

  const handleActivatePayments = async (accountId?: string) => {
    setLoading(true);
    setError(null);
    setOnboardingAccountId(accountId || null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expirée');

      let targetAccountId = accountId;

      if (!targetAccountId) {
        const createResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-manage-landlord-account`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'create', label: 'Compte principal' }),
          }
        );

        const createData = await createResponse.json();

        if (!createData.success) {
          throw new Error(createData.error || 'Erreur lors de la création du compte Stripe');
        }

        targetAccountId = createData.account.id;
        await fetchAccounts();
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
          body: JSON.stringify({ accountId: targetAccountId, origin: window.location.origin }),
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
      setOnboardingAccountId(null);
    }
  };

  const handleCreateAccount = async () => {
    if (!newAccountLabel.trim()) {
      setError(language === 'fr' ? 'Veuillez donner un nom à ce compte' : 'Please name this account');
      return;
    }

    setCreatingAccount(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expirée');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-manage-landlord-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'create', label: newAccountLabel.trim() }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors de la création du compte');
      }

      setNewAccountLabel('');
      setShowCreateForm(false);
      await fetchAccounts();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du compte');
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleOpenStripeDashboard = async (accountId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expirée');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-express-login`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accountId }),
        }
      );

      const data = await response.json();

      if (!data.success || !data.url) {
        throw new Error(data.error || 'Erreur lors de la génération du lien');
      }

      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'accès au dashboard Stripe');
    }
  };

  const handleSetDefault = async (accountId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-manage-landlord-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'set_default', accountId }),
        }
      );

      const data = await response.json();
      if (data.success) {
        await fetchAccounts();
        await refreshProfile();
      }
    } catch (err) {
      console.error('Error setting default:', err);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm(language === 'fr'
      ? 'Voulez-vous vraiment supprimer ce compte de versement ? (Le compte Stripe ne sera pas supprimé, mais ne sera plus accessible depuis la plateforme.)'
      : 'Are you sure you want to remove this payout account? (The Stripe account itself will not be deleted, but it will no longer be accessible from the platform.)'
    )) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-manage-landlord-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'delete', accountId }),
        }
      );

      const data = await response.json();
      if (data.success) {
        await fetchAccounts();
      } else {
        setError(data.error || 'Erreur lors de la suppression');
      }
    } catch (err) {
      console.error('Error deleting account:', err);
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

  const getAccountStatusBadge = (account: StripeAccount) => {
    const status = account.stripe_onboarding_status;
    if (status === 'complete') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3.5 h-3.5" />
          {language === 'fr' ? 'Vérifié' : 'Verified'}
        </span>
      );
    }
    if (status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <Clock className="w-3.5 h-3.5" />
          {language === 'fr' ? 'En attente' : 'Pending'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        {language === 'fr' ? 'Non configuré' : 'Not set up'}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <BackButton />

        {showMigrationNotice && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-5 relative">
            <button
              onClick={async () => {
                setShowMigrationNotice(false);
                if (user) {
                  await supabase.from('profiles').update({ stripe_migration_needed: false }).eq('id', user.id);
                }
              }}
              className="absolute top-3 right-3 p-1 rounded-lg hover:bg-amber-100 transition-colors"
            >
              <X className="w-4 h-4 text-amber-700" />
            </button>
            <div className="flex items-start gap-3 pr-6">
              <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900 mb-1">
                  {language === 'fr' ? 'Mise a jour du systeme de paiement' : 'Payment system update'}
                </h3>
                <p className="text-sm text-amber-800">
                  {language === 'fr'
                    ? "Suite a une mise a jour de notre systeme de paiement, vous devez reconfigurer votre compte Stripe. Cette operation prend moins de 5 minutes. Vos futures transactions seront traitees via notre nouvelle plateforme securisee."
                    : "Due to a payment system update, you need to reconfigure your Stripe account. This takes less than 5 minutes. Your future transactions will be processed through our new secure platform."}
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{language === 'fr' ? 'Gestion des Paiements' : 'Payment Management'}</h1>
          <p className="text-gray-600">
            {language === 'fr' ? 'Configurez vos comptes Stripe Connect pour recevoir les paiements de loyers' : 'Set up your Stripe Connect accounts to receive rent payments'}
          </p>
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

        {/* Default account status card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{statusMessage.title}</h2>
              <p className="text-gray-600">{statusMessage.description}</p>
            </div>
            <StripeStatusBadge status={stripeStatus} size="lg" />
          </div>

          {stripeStatus === 'not_connected' && (
            <button
              onClick={() => handleActivatePayments()}
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
        </div>

        {/* Multi-account management */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {language === 'fr' ? 'Mes comptes de versement' : 'My payout accounts'}
                </h2>
                <p className="text-sm text-gray-600">
                  {language === 'fr'
                    ? 'Connectez plusieurs comptes et attribuez-les à vos appartements'
                    : 'Connect multiple accounts and assign them to your listings'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium text-sm"
            >
              <Plus className="w-4 h-4" />
              {language === 'fr' ? 'Ajouter un compte' : 'Add account'}
            </button>
          </div>

          {showCreateForm && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                {language === 'fr' ? 'Nom du compte' : 'Account name'}
              </label>
              <input
                type="text"
                value={newAccountLabel}
                onChange={(e) => setNewAccountLabel(e.target.value)}
                placeholder={language === 'fr' ? 'ex: Compte personnel, SCI Fontainebleau...' : 'e.g., Personal account, SCI Fontainebleau...'}
                className="w-full px-4 py-3 border-2 border-blue-200 bg-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm mb-3"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateAccount(); }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateAccount}
                  disabled={creatingAccount || !newAccountLabel.trim()}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                >
                  {creatingAccount ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    language === 'fr' ? 'Créer le compte' : 'Create account'
                  )}
                </button>
                <button
                  onClick={() => { setShowCreateForm(false); setNewAccountLabel(''); }}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
                >
                  {language === 'fr' ? 'Annuler' : 'Cancel'}
                </button>
              </div>
            </div>
          )}

          {accountsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                {language === 'fr'
                  ? 'Aucun compte de versement configuré. Cliquez sur "Activer les paiements Stripe" pour commencer.'
                  : 'No payout account configured. Click "Activate Stripe payments" to get started.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  onClick={syncStripeStatus}
                  className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1.5 font-medium"
                >
                  <RefreshCw className="w-4 h-4" />
                  {language === 'fr' ? 'Synchroniser les statuts' : 'Sync statuses'}
                </button>
              </div>
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className={`border-2 rounded-xl p-4 transition-all ${
                    account.is_default
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        account.is_default ? 'bg-blue-600' : 'bg-gray-200'
                      }`}>
                        <CreditCard className={`w-5 h-5 ${account.is_default ? 'text-white' : 'text-gray-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 truncate">{account.label}</h3>
                          {account.is_default && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              <Star className="w-3 h-3" />
                              {language === 'fr' ? 'Par défaut' : 'Default'}
                            </span>
                          )}
                          {getAccountStatusBadge(account)}
                        </div>
                        <p className="text-xs text-gray-500 font-mono truncate">{account.stripe_account_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {account.stripe_onboarding_status === 'complete' && (
                        <button
                          onClick={() => handleOpenStripeDashboard(account.id)}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          {language === 'fr' ? 'Dashboard Stripe' : 'Stripe Dashboard'}
                        </button>
                      )}
                      {account.stripe_onboarding_status !== 'complete' && (
                        <button
                          onClick={() => handleActivatePayments(account.id)}
                          disabled={loading && onboardingAccountId === account.id}
                          className="px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          {loading && onboardingAccountId === account.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ExternalLink className="w-3.5 h-3.5" />
                          )}
                          {language === 'fr' ? 'Configurer' : 'Set up'}
                        </button>
                      )}
                      {!account.is_default && (
                        <>
                          <button
                            onClick={() => handleSetDefault(account.id)}
                            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs font-medium flex items-center gap-1.5"
                          >
                            <Star className="w-3.5 h-3.5" />
                            {language === 'fr' ? 'Défaut' : 'Default'}
                          </button>
                          <button
                            onClick={() => handleDeleteAccount(account.id)}
                            className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
      </div>
    </div>
  );
}
