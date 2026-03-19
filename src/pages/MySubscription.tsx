import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, CreditCard, FileText, TrendingUp, Calendar, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useStripeCheckout } from '../hooks/useStripeCheckout';
import BackButton from '../components/BackButton';

type Subscription = {
  id: string;
  plan_type: 'free' | 'premium';
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
};

type Invoice = {
  id: string;
  stripe_invoice_id: string;
  amount: number;
  currency: string;
  status: string;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
  billing_reason: string | null;
  created_at: string;
};

type PricingPlan = {
  id: string;
  name: string;
  name_en: string;
  price: number;
  billing_period: string;
  features: string[];
  features_en: string[];
  stripe_price_id: string | null;
  is_active: boolean;
};

export default function MySubscription() {
  const { user, profile } = useAuth();
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [pricingPlans, setPricingPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'plan' | 'invoices'>('plan');
  const [cancelingSubscription, setCancelingSubscription] = useState(false);
  const [syncingInvoices, setSyncingInvoices] = useState(false);
  const { createCheckoutSession, loading: checkoutLoading, error: checkoutError } = useStripeCheckout();

  const [showSuccess, setShowSuccess] = useState(false);
  const [showCanceled, setShowCanceled] = useState(false);

  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    if (success || canceled) {
      if (success) setShowSuccess(true);
      if (canceled) setShowCanceled(true);

      const params = new URLSearchParams(searchParams);
      params.delete('success');
      params.delete('canceled');
      setSearchParams(params, { replace: true });
    }
  }, []);

  useEffect(() => {
    if (showSuccess || showCanceled) {
      const timer = setTimeout(() => {
        setShowSuccess(false);
        setShowCanceled(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess, showCanceled]);

  useEffect(() => {
    if (user && profile?.role === 'landlord') {
      loadSubscriptionData();
    }
  }, [user, profile]);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);

      // Load pricing plans
      const { data: plansData, error: plansError } = await supabase
        .from('pricing_plans')
        .select('*')
        .eq('type', 'landlord')
        .eq('plan_category', 'subscription')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (plansError) throw plansError;
      setPricingPlans(plansData || []);

      // Load subscription
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (subError) throw subError;

      // If no subscription exists, create a free one
      if (!subData) {
        const { data: newSub, error: createError } = await supabase
          .from('subscriptions')
          .insert({
            user_id: user!.id,
            plan_type: 'free',
            status: 'active',
          })
          .select()
          .single();

        if (createError) throw createError;
        setSubscription(newSub);
      } else {
        setSubscription(subData);
      }

      // Load invoices
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (invoicesError) throw invoicesError;
      setInvoices(invoicesData || []);
    } catch (error) {
      console.error('Error loading subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentPlanData = () => {
    if (!subscription) return null;
    return pricingPlans.find(plan => {
      if (subscription.plan_type === 'free') {
        return plan.price === 0;
      } else if (subscription.plan_type === 'premium') {
        return plan.price > 0;
      }
      return false;
    });
  };

  const getPremiumPlan = () => {
    return pricingPlans.find(plan => plan.price > 0);
  };

  const getPlanName = (planData: PricingPlan | null | undefined) => {
    if (!planData) return language === 'fr' ? 'Plan inconnu' : 'Unknown plan';
    return language === 'fr' ? planData.name : planData.name_en;
  };

  const getPlanPrice = (planData: PricingPlan | null | undefined) => {
    if (!planData) return '';
    if (planData.price === 0) {
      return language === 'fr' ? 'Gratuit' : 'Free';
    }
    return `${planData.price}€/mois`;
  };

  const getPlanFeatures = (planData: PricingPlan | null | undefined) => {
    if (!planData) return [];
    const features = language === 'fr' ? planData.features : planData.features_en;
    return features.map(feature => ({ name: feature, included: true }));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  const formatAmount = (amountInCents: number, currency: string) => {
    const amount = amountInCents / 100;
    return new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const handleUpgrade = async () => {
    try {
      const premiumPlan = getPremiumPlan();

      if (!premiumPlan?.stripe_price_id) {
        alert(
          language === 'fr'
            ? 'Le paiement n\'est pas encore configuré. Veuillez contacter le support.'
            : 'Payment is not yet configured. Please contact support.'
        );
        return;
      }

      const baseUrl = window.location.origin;
      await createCheckoutSession({
        priceId: premiumPlan.stripe_price_id,
        mode: 'subscription',
        successUrl: `${baseUrl}/mon-abonnement?success=true`,
        cancelUrl: `${baseUrl}/mon-abonnement?canceled=true`,
      });
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      alert(
        language === 'fr'
          ? 'Une erreur est survenue. Veuillez réessayer.'
          : 'An error occurred. Please try again.'
      );
    }
  };

  const handleCancelSubscription = async () => {
    console.log('handleCancelSubscription called', { subscription });

    if (!subscription) {
      console.error('No subscription found');
      alert(
        language === 'fr'
          ? 'Impossible de charger les informations d\'abonnement. Veuillez rafraîchir la page.'
          : 'Unable to load subscription information. Please refresh the page.'
      );
      return;
    }

    console.log('Subscription exists, checking stripe_subscription_id:', subscription.stripe_subscription_id);

    if (!subscription.stripe_subscription_id) {
      console.error('No stripe_subscription_id found');
      alert(
        language === 'fr'
          ? 'Aucun abonnement actif trouvé. Veuillez contacter le support si vous pensez qu\'il s\'agit d\'une erreur.'
          : 'No active subscription found. Please contact support if you believe this is an error.'
      );
      return;
    }

    console.log('About to show confirmation dialog');

    const confirmMessage = language === 'fr'
      ? 'Êtes-vous sûr de vouloir annuler votre abonnement Premium ? Vous conserverez vos avantages jusqu\'à la fin de la période en cours.'
      : 'Are you sure you want to cancel your Premium subscription? You will keep your benefits until the end of the current period.';

    console.log('Confirmation message:', confirmMessage);

    const confirmed = window.confirm(confirmMessage);

    console.log('User confirmed:', confirmed);

    if (!confirmed) {
      console.log('User cancelled the action');
      return;
    }

    try {
      setCancelingSubscription(true);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        alert(
          language === 'fr'
            ? 'Erreur d\'authentification. Veuillez vous reconnecter.'
            : 'Authentication error. Please sign in again.'
        );
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-cancel-subscription`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to cancel subscription');
      }

      const endDate = result.current_period_end
        ? formatDate(result.current_period_end)
        : '';

      alert(
        language === 'fr'
          ? `Votre abonnement a été annulé avec succès. Vous conserverez vos avantages Premium jusqu'au ${endDate}.`
          : `Your subscription has been successfully canceled. You will keep your Premium benefits until ${endDate}.`
      );

      await loadSubscriptionData();
    } catch (error: any) {
      console.error('Error canceling subscription:', error);
      alert(
        language === 'fr'
          ? error.message || 'Une erreur est survenue. Veuillez réessayer.'
          : error.message || 'An error occurred. Please try again.'
      );
    } finally {
      setCancelingSubscription(false);
    }
  };

  const handleSyncInvoices = async () => {
    try {
      setSyncingInvoices(true);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        alert(
          language === 'fr'
            ? 'Erreur d\'authentification. Veuillez vous reconnecter.'
            : 'Authentication error. Please sign in again.'
        );
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-missing-invoice`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to sync invoices');
      }

      alert(
        language === 'fr'
          ? `Synchronisation réussie ! ${result.synced} facture(s) récupérée(s).`
          : `Sync successful! ${result.synced} invoice(s) retrieved.`
      );

      await loadSubscriptionData();
    } catch (error) {
      console.error('Error syncing invoices:', error);
      alert(
        language === 'fr'
          ? 'Une erreur est survenue lors de la synchronisation. Veuillez réessayer.'
          : 'An error occurred during synchronization. Please try again.'
      );
    } finally {
      setSyncingInvoices(false);
    }
  };

  if (profile?.role !== 'landlord') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            {language === 'fr' ? 'Accès réservé aux propriétaires' : 'Access reserved for landlords'}
          </h2>
          <button
            onClick={() => navigate('/')}
            className="text-rose-500 hover:text-rose-600 font-medium"
          >
            {language === 'fr' ? 'Retour à l\'accueil' : 'Back to home'}
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BackButton />
        {showSuccess && (
          <div className="mb-8 bg-green-50 border border-green-200 rounded-xl p-4 flex items-start space-x-3">
            <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-900 mb-1">
                {language === 'fr' ? 'Paiement réussi !' : 'Payment successful!'}
              </h3>
              <p className="text-sm text-green-700">
                {language === 'fr'
                  ? 'Votre abonnement Premium a été activé avec succès. Profitez de tous vos nouveaux avantages !'
                  : 'Your Premium subscription has been successfully activated. Enjoy all your new benefits!'}
              </p>
            </div>
          </div>
        )}

        {showCanceled && (
          <div className="mb-8 bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start space-x-3">
            <AlertCircle className="h-6 w-6 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-orange-900 mb-1">
                {language === 'fr' ? 'Paiement annulé' : 'Payment canceled'}
              </h3>
              <p className="text-sm text-orange-700">
                {language === 'fr'
                  ? 'Votre paiement a été annulé. Vous pouvez réessayer à tout moment.'
                  : 'Your payment has been canceled. You can try again at any time.'}
              </p>
            </div>
          </div>
        )}

        {checkoutError && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
            <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">
                {language === 'fr' ? 'Erreur' : 'Error'}
              </h3>
              <p className="text-sm text-red-700">{checkoutError}</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {language === 'fr' ? 'Mon abonnement' : 'My Subscription'}
          </h1>
          <p className="mt-2 text-gray-600">
            {language === 'fr'
              ? 'Gérez votre abonnement et consultez vos factures'
              : 'Manage your subscription and view your invoices'}
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('plan')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'plan'
                  ? 'border-rose-500 text-rose-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5" />
                <span>{language === 'fr' ? 'Mon forfait' : 'My Plan'}</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'invoices'
                  ? 'border-rose-500 text-rose-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>{language === 'fr' ? 'Factures' : 'Invoices'}</span>
                {invoices.length > 0 && (
                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                    {invoices.length}
                  </span>
                )}
              </div>
            </button>
          </nav>
        </div>

        {/* Content */}
        {activeTab === 'plan' ? (
          <div>
            {/* Current Plan */}
            {subscription && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-1">
                      {language === 'fr' ? 'Forfait actuel' : 'Current Plan'}
                    </h2>
                    <div className="flex items-center space-x-3">
                      <span className="text-3xl font-bold text-rose-500">
                        {getPlanName(getCurrentPlanData())}
                      </span>
                      <span className="text-2xl text-gray-600">
                        {getPlanPrice(getCurrentPlanData())}
                      </span>
                    </div>
                  </div>
                  {subscription.plan_type !== 'free' && subscription.current_period_end && (
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        {language === 'fr' ? 'Renouvellement' : 'Renewal'}
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {formatDate(subscription.current_period_end)}
                      </div>
                      {subscription.cancel_at_period_end && (
                        <div className="mt-1 text-xs text-orange-600">
                          {language === 'fr' ? 'Annulation prévue' : 'Cancellation scheduled'}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {getPlanFeatures(getCurrentPlanData()).map((feature, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      {feature.included ? (
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-300 flex-shrink-0" />
                      )}
                      <span className={feature.included ? 'text-gray-900' : 'text-gray-400'}>
                        {feature.name}
                      </span>
                    </div>
                  ))}
                </div>

                {subscription.plan_type === 'premium' && !subscription.cancel_at_period_end && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Cancel button clicked', {
                          cancelingSubscription,
                          subscription,
                          hasHandler: typeof handleCancelSubscription === 'function'
                        });
                        handleCancelSubscription();
                      }}
                      disabled={cancelingSubscription}
                      className="px-4 py-2 text-sm font-medium text-red-600 hover:text-white hover:bg-red-600 border border-red-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cancelingSubscription
                        ? (language === 'fr' ? 'Annulation en cours...' : 'Canceling...')
                        : (language === 'fr' ? 'Annuler mon abonnement' : 'Cancel my subscription')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Available Plans */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {language === 'fr' ? 'Passer à un forfait supérieur' : 'Upgrade Your Plan'}
              </h2>
              <div className="max-w-md mx-auto">
                {/* Premium Plan */}
                {subscription?.plan_type === 'free' && getPremiumPlan() && (
                  <div className="bg-rose-500 text-white rounded-xl shadow-lg p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-gray-900 text-white px-3 py-1 text-xs font-semibold">
                      {language === 'fr' ? 'POPULAIRE' : 'POPULAR'}
                    </div>
                    <div className="mb-4">
                      <h3 className="text-2xl font-bold mb-2">{getPlanName(getPremiumPlan())}</h3>
                      <div className="text-3xl font-bold mb-4">{getPlanPrice(getPremiumPlan())}</div>
                    </div>
                    <div className="space-y-3 mb-6">
                      {getPlanFeatures(getPremiumPlan()).map((feature, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          <CheckCircle className="h-5 w-5 text-white flex-shrink-0" />
                          <span className="text-white">{feature.name}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleUpgrade}
                      disabled={checkoutLoading}
                      className="w-full bg-white text-rose-500 py-3 rounded-lg font-semibold hover:bg-gray-50 transition flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {checkoutLoading ? (
                        <>
                          <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>{language === 'fr' ? 'Chargement...' : 'Loading...'}</span>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="h-5 w-5" />
                          <span>{language === 'fr' ? 'Choisir Premium' : 'Choose Premium'}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Invoices Tab */
          <div>
            {invoices.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {language === 'fr' ? 'Aucune facture' : 'No Invoices'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {language === 'fr'
                    ? 'Vos factures apparaîtront ici une fois que vous aurez souscrit à un abonnement payant.'
                    : 'Your invoices will appear here once you subscribe to a paid plan.'}
                </p>
                {subscription?.plan_type === 'premium' && (
                  <button
                    onClick={handleSyncInvoices}
                    disabled={syncingInvoices}
                    className="inline-flex items-center space-x-2 px-6 py-3 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`h-5 w-5 ${syncingInvoices ? 'animate-spin' : ''}`} />
                    <span>
                      {syncingInvoices
                        ? (language === 'fr' ? 'Synchronisation...' : 'Syncing...')
                        : (language === 'fr' ? 'Récupérer mes factures' : 'Retrieve my invoices')}
                    </span>
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {language === 'fr' ? 'Date' : 'Date'}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {language === 'fr' ? 'Montant' : 'Amount'}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {language === 'fr' ? 'Statut' : 'Status'}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {language === 'fr' ? 'Actions' : 'Actions'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {invoices.map((invoice) => (
                        <tr key={invoice.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Calendar className="h-5 w-5 text-gray-400 mr-2" />
                              <span className="text-sm text-gray-900">
                                {formatDate(invoice.created_at)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900">
                              {formatAmount(invoice.amount, invoice.currency)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                invoice.status === 'paid'
                                  ? 'bg-green-100 text-green-800'
                                  : invoice.status === 'open'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {invoice.status === 'paid'
                                ? language === 'fr'
                                  ? 'Payée'
                                  : 'Paid'
                                : invoice.status === 'open'
                                ? language === 'fr'
                                  ? 'En attente'
                                  : 'Open'
                                : invoice.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center space-x-3">
                              {invoice.invoice_pdf && (
                                <a
                                  href={invoice.invoice_pdf}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-rose-500 hover:text-rose-600 font-medium"
                                >
                                  {language === 'fr' ? 'PDF' : 'PDF'}
                                </a>
                              )}
                              {invoice.hosted_invoice_url && (
                                <a
                                  href={invoice.hosted_invoice_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-rose-500 hover:text-rose-600 font-medium"
                                >
                                  {language === 'fr' ? 'Voir' : 'View'}
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
