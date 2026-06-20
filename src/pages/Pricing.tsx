import { Check, Crown, Users, ArrowLeft, Sparkles, GraduationCap, Home, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { STRIPE_PRODUCTS } from '../stripe-config';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useStripeSubscription } from '../hooks/useStripeSubscription';
import CheckoutButton from '../components/CheckoutButton';

export default function Pricing() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { profile } = useAuth();
  const { isActive, priceId } = useStripeSubscription();
  const fr = language === 'fr';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-rose-50">
      <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-10 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          {fr ? 'Retour' : 'Back'}
        </button>

        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-rose-100 text-rose-700 rounded-full text-sm font-semibold mb-4">
            <Sparkles className="w-4 h-4" />
            {fr ? 'Nos offres' : 'Our plans'}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {fr ? 'Simple, transparent.' : 'Simple, transparent.'}
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            {fr
              ? 'Des offres adaptées à chaque profil, sans frais cachés.'
              : 'Plans tailored to each profile, no hidden fees.'}
          </p>
        </div>

        {/* === SECTION ETUDIANTS === */}
        <div className="mb-20">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {fr ? 'Pour les étudiants INSEAD' : 'For INSEAD students'}
              </h2>
              <p className="text-sm text-gray-500">
                {fr ? 'Un paiement unique pour accéder à tous les logements' : 'One-time payment to access all listings'}
              </p>
            </div>
          </div>

          <div className="max-w-lg">
            <div className="relative flex flex-col rounded-2xl border-2 border-blue-200 bg-white shadow-lg hover:shadow-xl transition-all p-8">
              <div className="inline-flex items-center gap-2 self-start px-3 py-1 rounded-full text-xs font-semibold mb-5 bg-blue-100 text-blue-700">
                <Users className="w-4 h-4" />
                {fr ? 'Étudiants INSEAD' : 'INSEAD Students'}
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {fr ? STRIPE_PRODUCTS.MISE_EN_RELATION.name : STRIPE_PRODUCTS.MISE_EN_RELATION.nameEn}
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                {fr ? STRIPE_PRODUCTS.MISE_EN_RELATION.description : STRIPE_PRODUCTS.MISE_EN_RELATION.descriptionEn}
              </p>

              <div className="flex items-end gap-1 mb-8">
                <span className="text-5xl font-black text-gray-900 leading-none">
                  {STRIPE_PRODUCTS.MISE_EN_RELATION.currencySymbol}{STRIPE_PRODUCTS.MISE_EN_RELATION.price}
                </span>
                <span className="text-gray-400 text-sm pb-1">
                  {fr ? '/ unique' : '/ one-time'}
                </span>
              </div>

              <ul className="space-y-3 mb-8">
                {(fr ? STRIPE_PRODUCTS.MISE_EN_RELATION.features : STRIPE_PRODUCTS.MISE_EN_RELATION.featuresEn).map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 bg-blue-100">
                      <Check className="w-3 h-3 text-blue-600" />
                    </div>
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => navigate('/recherche')}
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                {fr ? 'Trouver un logement' : 'Find a listing'}
              </button>
            </div>
          </div>
        </div>

        {/* === SECTION PROPRIETAIRES === */}
        <div className="mb-14">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
              <Home className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {fr ? 'Pour les propriétaires' : 'For landlords'}
              </h2>
              <p className="text-sm text-gray-500">
                {fr ? 'Choisissez le forfait adapté à vos besoins' : 'Choose the plan that fits your needs'}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Forfait Gratuit */}
            <div className="relative flex flex-col rounded-2xl border-2 border-gray-200 bg-white shadow-lg hover:shadow-xl transition-all p-8">
              <div className="inline-flex items-center gap-2 self-start px-3 py-1 rounded-full text-xs font-semibold mb-5 bg-gray-100 text-gray-700">
                <Home className="w-4 h-4" />
                {fr ? 'Propriétaires' : 'Landlords'}
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {fr ? 'Hellofonty Gratuit' : 'Hellofonty Free'}
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                {fr
                  ? 'Publiez vos annonces et trouvez des locataires INSEAD vérifiés gratuitement.'
                  : 'Publish your listings and find verified INSEAD tenants for free.'}
              </p>

              <div className="flex items-end gap-1 mb-8">
                <span className="text-5xl font-black text-gray-900 leading-none">
                  {STRIPE_PRODUCTS.MISE_EN_RELATION.currencySymbol}0
                </span>
                <span className="text-gray-400 text-sm pb-1">
                  {fr ? '/ toujours' : '/ forever'}
                </span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {(fr ? [
                  'Jusqu\'à 3 annonces',
                  'Messagerie sécurisée',
                  'Demandes de réservation',
                  'Profil propriétaire vérifié',
                  'Support par email',
                ] : [
                  'Up to 3 listings',
                  'Secure messaging',
                  'Booking requests',
                  'Verified landlord profile',
                  'Email support',
                ]).map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 bg-green-100">
                      <Check className="w-3 h-3 text-green-600" />
                    </div>
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              {!profile ? (
                <button
                  onClick={() => navigate('/inscription')}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all bg-gray-900 hover:bg-gray-800 text-white"
                >
                  {fr ? 'S\'inscrire gratuitement' : 'Sign up for free'}
                </button>
              ) : (
                <div className="w-full py-3.5 bg-green-50 border-2 border-green-200 text-green-700 font-semibold rounded-xl text-center text-sm">
                  {fr ? '✓ Inclus avec votre compte' : '✓ Included with your account'}
                </div>
              )}
            </div>

            {/* Forfait Premium */}
            <div className="relative flex flex-col rounded-2xl border-2 border-rose-500 shadow-2xl shadow-rose-100/50 bg-white transition-all p-8">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="px-4 py-1 bg-rose-600 text-white text-xs font-bold rounded-full shadow">
                  {fr ? 'Le plus populaire' : 'Most popular'}
                </span>
              </div>

              <div className="inline-flex items-center gap-2 self-start px-3 py-1 rounded-full text-xs font-semibold mb-5 bg-rose-100 text-rose-700">
                <Crown className="w-4 h-4" />
                {fr ? 'Propriétaires' : 'Landlords'}
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {fr ? STRIPE_PRODUCTS.HELLOFONTY_PREMIUM.name : STRIPE_PRODUCTS.HELLOFONTY_PREMIUM.nameEn}
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                {fr ? STRIPE_PRODUCTS.HELLOFONTY_PREMIUM.description : STRIPE_PRODUCTS.HELLOFONTY_PREMIUM.descriptionEn}
              </p>

              <div className="flex items-end gap-1 mb-8">
                <span className="text-5xl font-black text-gray-900 leading-none">
                  {STRIPE_PRODUCTS.HELLOFONTY_PREMIUM.currencySymbol}{STRIPE_PRODUCTS.HELLOFONTY_PREMIUM.price}
                </span>
                <span className="text-gray-400 text-sm pb-1">
                  {fr ? '/ mois' : '/ month'}
                </span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {(fr ? STRIPE_PRODUCTS.HELLOFONTY_PREMIUM.features : STRIPE_PRODUCTS.HELLOFONTY_PREMIUM.featuresEn).map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 bg-rose-100">
                      <Check className="w-3 h-3 text-rose-600" />
                    </div>
                    <span className="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              {isActive && priceId === STRIPE_PRODUCTS.HELLOFONTY_PREMIUM.priceId ? (
                <div className="w-full py-3.5 bg-green-50 border-2 border-green-200 text-green-700 font-semibold rounded-xl text-center text-sm">
                  {fr ? '✓ Votre abonnement actuel' : '✓ Your current plan'}
                </div>
              ) : !profile ? (
                <button
                  onClick={() => navigate('/inscription')}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200 hover:shadow-rose-300"
                >
                  {fr ? 'S\'inscrire maintenant' : 'Sign up now'}
                </button>
              ) : (
                <CheckoutButton
                  product={STRIPE_PRODUCTS.HELLOFONTY_PREMIUM}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200 hover:shadow-rose-300"
                >
                  {fr ? 'Souscrire maintenant' : 'Subscribe now'}
                </CheckoutButton>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-gray-400">
          {fr
            ? 'Paiement sécurisé par Stripe · Résiliable à tout moment'
            : 'Secure payment by Stripe · Cancel anytime'}
        </p>
      </div>
    </div>
  );
}
