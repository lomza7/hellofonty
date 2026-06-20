import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Crown, ArrowRight, Loader2 } from 'lucide-react';
import { useStripeSubscription } from '../hooks/useStripeSubscription';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { profile } = useAuth();
  const { isActive, product, loading, refresh } = useStripeSubscription();
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 12;

    const poll = async () => {
      await refresh();
      attempts++;
      if (attempts >= maxAttempts) setPolling(false);
    };

    poll();
    const interval = setInterval(async () => {
      await refresh();
      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setPolling(false);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isActive) setPolling(false);
  }, [isActive]);

  const fr = language === 'fr';
  const dashboardPath = profile?.role === 'landlord' ? '/espace-proprietaire' : '/espace-etudiant';

  if (loading || (polling && !isActive)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-rose-500 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">
            {fr ? 'Confirmation de votre abonnement...' : 'Confirming your subscription...'}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {fr ? 'Cela peut prendre quelques secondes.' : 'This may take a few seconds.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 md:p-10 text-center">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center shadow-lg">
                <CheckCircle className="w-13 h-13 text-white" strokeWidth={1.5} />
              </div>
              <div className="absolute -top-1 -right-1 w-9 h-9 bg-amber-400 rounded-full flex items-center justify-center shadow-md border-2 border-white">
                <Crown className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            {fr ? 'Paiement réussi !' : 'Payment successful!'}
          </h1>

          {isActive && product ? (
            <>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 border border-amber-200 rounded-full mb-3">
                <Crown className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-700">
                  {fr ? product.name : product.nameEn}
                </span>
              </div>
              <p className="text-gray-600 mb-2 text-sm">
                {fr
                  ? `Votre abonnement ${product.name} est maintenant actif.`
                  : `Your ${product.nameEn} subscription is now active.`}
              </p>
            </>
          ) : (
            <p className="text-gray-600 mb-4 text-sm">
              {fr ? 'Votre abonnement a bien été activé.' : 'Your subscription has been activated.'}
            </p>
          )}

          <p className="text-sm text-gray-400 mb-8">
            {fr
              ? 'Vous allez recevoir un email de confirmation sous peu.'
              : 'You will receive a confirmation email shortly.'}
          </p>

          <div className="space-y-3">
            <button
              onClick={() => navigate(dashboardPath)}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl transition-colors"
            >
              {fr ? 'Accéder à mon espace' : 'Go to my dashboard'}
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full px-6 py-3 text-gray-500 hover:text-gray-800 font-medium transition-colors text-sm underline"
            >
              {fr ? 'Retour à l\'accueil' : 'Back to home'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}