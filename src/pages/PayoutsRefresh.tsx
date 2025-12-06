import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { AlertCircle, RefreshCw, ExternalLink, Home } from 'lucide-react';

export default function PayoutsRefresh() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.role !== 'landlord') {
      navigate('/');
    }
  }, [profile, navigate]);

  const handleContinueOnboarding = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expirée');

      if (!profile?.stripe_account_id) {
        throw new Error('Aucun compte Stripe trouvé. Veuillez recommencer depuis la page Paiements.');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-create-onboarding-link`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ accountId: profile.stripe_account_id }),
        }
      );

      const data = await response.json();

      if (!data.success || !data.url) {
        throw new Error(data.error || 'Erreur lors de la génération du lien d\'onboarding');
      }

      window.location.href = data.url;
    } catch (err: any) {
      console.error('Erreur reprise onboarding:', err);
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Reprenons où vous en étiez</h1>
            <p className="text-lg text-gray-600">
              Vous avez interrompu la configuration de votre compte Stripe
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-6">
            <p className="text-yellow-900 mb-3">
              Pas d'inquiétude ! Vous pouvez reprendre la configuration de votre compte Stripe
              à tout moment en cliquant sur le bouton ci-dessous.
            </p>
            <p className="text-sm text-yellow-800">
              Toutes les informations que vous avez déjà fournies ont été sauvegardées.
            </p>
          </div>

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
              onClick={handleContinueOnboarding}
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
                  Reprendre la configuration
                </>
              )}
            </button>

            <Link
              to="/proprietaire/paiements"
              className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
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

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Besoin d'aide ?</h3>
            <p className="text-sm text-gray-600 mb-2">
              Si vous rencontrez des difficultés, n'hésitez pas à :
            </p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Vérifier que vous avez bien tous les documents nécessaires (pièce d'identité, IBAN)</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Contacter notre support via le chat en bas à droite</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
