import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, CreditCard, FileText, TrendingUp, Calendar } from 'lucide-react';

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

type MySubscriptionProps = {
  onNavigate: (page: string) => void;
};

export default function MySubscription({ onNavigate }: MySubscriptionProps) {
  const { user, profile } = useAuth();
  const { language, t } = useLanguage();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'plan' | 'invoices'>('plan');

  useEffect(() => {
    if (user && profile?.role === 'landlord') {
      loadSubscriptionData();
    }
  }, [user, profile]);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);

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

  const getPlanName = (planType: string) => {
    switch (planType) {
      case 'free':
        return language === 'fr' ? 'Offre Gratuite' : 'Free Plan';
      case 'premium':
        return language === 'fr' ? 'Gestion Complète' : 'Full Management';
      default:
        return planType;
    }
  };

  const getPlanPrice = (planType: string) => {
    switch (planType) {
      case 'free':
        return language === 'fr' ? 'Gratuit' : 'Free';
      case 'premium':
        return '29€/mois';
      default:
        return '';
    }
  };

  const getPlanFeatures = (planType: string) => {
    switch (planType) {
      case 'free':
        return [
          { name: language === 'fr' ? 'Publication illimitée d\'annonces' : 'Unlimited listing posts', included: true },
          { name: language === 'fr' ? 'Photos et descriptions détaillées' : 'Photos and detailed descriptions', included: true },
          { name: language === 'fr' ? 'Messagerie directe avec étudiants' : 'Direct messaging with students', included: true },
          { name: language === 'fr' ? 'Gestion autonome des réservations' : 'Self-managed bookings', included: true },
          { name: language === 'fr' ? 'Profil propriétaire vérifié' : 'Verified landlord profile', included: true },
        ];
      case 'premium':
        return [
          { name: language === 'fr' ? 'Tout de l\'offre gratuite' : 'Everything in Free plan', included: true },
          { name: language === 'fr' ? 'Gestion complète des réservations' : 'Full booking management', included: true },
          { name: language === 'fr' ? 'Accueil et remise des clés' : 'Welcome and key handover', included: true },
          { name: language === 'fr' ? 'État des lieux entrée/sortie' : 'Check-in/check-out inventory', included: true },
          { name: language === 'fr' ? 'Ménage entre locataires' : 'Cleaning between tenants', included: true },
          { name: language === 'fr' ? 'Support client 7j/7' : '24/7 customer support', included: true },
          { name: language === 'fr' ? 'Assurance dommages incluse' : 'Damage insurance included', included: true },
        ];
      default:
        return [];
    }
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

  const handleUpgrade = (targetPlan: 'premium') => {
    // TODO: Implement Stripe payment flow
    alert(
      language === 'fr'
        ? `Pour passer au plan ${getPlanName(targetPlan)}, veuillez configurer Stripe.\n\nRendez-vous sur https://bolt.new/setup/stripe pour plus d'informations.`
        : `To upgrade to ${getPlanName(targetPlan)}, please configure Stripe.\n\nVisit https://bolt.new/setup/stripe for more information.`
    );
  };

  if (profile?.role !== 'landlord') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            {language === 'fr' ? 'Accès réservé aux propriétaires' : 'Access reserved for landlords'}
          </h2>
          <button
            onClick={() => onNavigate('home')}
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
                        {getPlanName(subscription.plan_type)}
                      </span>
                      <span className="text-2xl text-gray-600">
                        {getPlanPrice(subscription.plan_type)}
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
                  {getPlanFeatures(subscription.plan_type).map((feature, index) => (
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
              </div>
            )}

            {/* Available Plans */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {language === 'fr' ? 'Passer à un forfait supérieur' : 'Upgrade Your Plan'}
              </h2>
              <div className="max-w-md mx-auto">
                {/* Premium Plan */}
                {subscription?.plan_type === 'free' && (
                  <div className="bg-rose-500 text-white rounded-xl shadow-lg p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-gray-900 text-white px-3 py-1 text-xs font-semibold">
                      {language === 'fr' ? 'POPULAIRE' : 'POPULAR'}
                    </div>
                    <div className="mb-4">
                      <h3 className="text-2xl font-bold mb-2">{language === 'fr' ? 'Gestion Complète' : 'Full Management'}</h3>
                      <div className="text-3xl font-bold mb-4">29€/mois</div>
                    </div>
                    <div className="space-y-3 mb-6">
                      {getPlanFeatures('premium').map((feature, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          <CheckCircle className="h-5 w-5 text-white flex-shrink-0" />
                          <span className="text-white">{feature.name}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleUpgrade('premium')}
                      className="w-full bg-white text-rose-500 py-3 rounded-lg font-semibold hover:bg-gray-50 transition flex items-center justify-center space-x-2"
                    >
                      <TrendingUp className="h-5 w-5" />
                      <span>{language === 'fr' ? 'Choisir Premium' : 'Choose Premium'}</span>
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
                <p className="text-gray-500">
                  {language === 'fr'
                    ? 'Vos factures apparaîtront ici une fois que vous aurez souscrit à un abonnement payant.'
                    : 'Your invoices will appear here once you subscribe to a paid plan.'}
                </p>
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
