import { Check, Crown, Users, ArrowLeft, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { STRIPE_PRODUCTS, StripeProduct } from '../stripe-config';
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
      <div className="max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-10 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          {fr ? 'Retour' : 'Back'}
        </button>

        <div className="text-center mb-14">
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

        <div className="grid md:grid-cols-2 gap-8 mb-10">
          <PricingCard
            product={STRIPE_PRODUCTS.MISE_EN_RELATION}
            icon={<Users className="w-5 h-5" />}
            audienceLabel={fr ? 'Pour les étudiants INSEAD' : 'For INSEAD students'}
            isHighlighted={false}
            language={language}
            isCurrentPlan={isActive && priceId === STRIPE_PRODUCTS.MISE_EN_RELATION.priceId}
            isAuthenticated={!!profile}
            hasOtherActivePlan={isActive && priceId !== STRIPE_PRODUCTS.MISE_EN_RELATION.priceId}
          />
          <PricingCard
            product={STRIPE_PRODUCTS.HELLOFONTY_PREMIUM}
            icon={<Crown className="w-5 h-5" />}
            audienceLabel={fr ? 'Pour les propriétaires' : 'For landlords'}
            isHighlighted={true}
            language={language}
            isCurrentPlan={isActive && priceId === STRIPE_PRODUCTS.HELLOFONTY_PREMIUM.priceId}
            isAuthenticated={!!profile}
            hasOtherActivePlan={isActive && priceId !== STRIPE_PRODUCTS.HELLOFONTY_PREMIUM.priceId}
          />
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

interface PricingCardProps {
  product: StripeProduct;
  icon: React.ReactNode;
  audienceLabel: string;
  isHighlighted: boolean;
  language: string;
  isCurrentPlan: boolean;
  isAuthenticated: boolean;
  hasOtherActivePlan: boolean;
}

function PricingCard({
  product,
  icon,
  audienceLabel,
  isHighlighted,
  language,
  isCurrentPlan,
  isAuthenticated,
  hasOtherActivePlan,
}: PricingCardProps) {
  const navigate = useNavigate();
  const fr = language === 'fr';
  const features = fr ? product.features : product.featuresEn;
  const name = fr ? product.name : product.nameEn;
  const description = fr ? product.description : product.descriptionEn;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border-2 p-8 transition-all ${
        isHighlighted
          ? 'border-rose-500 shadow-2xl shadow-rose-100/50 bg-white'
          : 'border-gray-200 bg-white shadow-lg hover:shadow-xl'
      }`}
    >
      {isHighlighted && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="px-4 py-1 bg-rose-600 text-white text-xs font-bold rounded-full shadow">
            {fr ? 'Le plus populaire' : 'Most popular'}
          </span>
        </div>
      )}

      {/* Audience */}
      <div className={`inline-flex items-center gap-2 self-start px-3 py-1 rounded-full text-xs font-semibold mb-5 ${
        isHighlighted ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
      }`}>
        {icon}
        {audienceLabel}
      </div>

      {/* Title & description */}
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{name}</h2>
      <p className="text-gray-500 text-sm leading-relaxed mb-6">{description}</p>

      {/* Price */}
      <div className="flex items-end gap-1 mb-8">
        <span className="text-5xl font-black text-gray-900 leading-none">
          {product.currencySymbol}{product.price}
        </span>
        <span className="text-gray-400 text-sm pb-1">
          {product.mode === 'payment'
            ? (fr ? '/ unique' : '/ one-time')
            : (fr ? '/ mois' : '/ month')}
        </span>
      </div>

      {/* Features */}
      <ul className="space-y-3 mb-8 flex-1">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${
              isHighlighted ? 'bg-rose-100' : 'bg-green-100'
            }`}>
              <Check className={`w-3 h-3 ${isHighlighted ? 'text-rose-600' : 'text-green-600'}`} />
            </div>
            <span className="text-sm text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      {isCurrentPlan ? (
        <div className="w-full py-3.5 bg-green-50 border-2 border-green-200 text-green-700 font-semibold rounded-xl text-center text-sm">
          {fr ? '✓ Votre abonnement actuel' : '✓ Your current plan'}
        </div>
      ) : !isAuthenticated ? (
        <button
          onClick={() => navigate('/auth')}
          className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
            isHighlighted
              ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200 hover:shadow-rose-300'
              : 'bg-gray-900 hover:bg-gray-800 text-white'
          }`}
        >
          {fr ? 'Se connecter pour souscrire' : 'Sign in to subscribe'}
        </button>
      ) : (
        <CheckoutButton
          product={product}
          disabled={hasOtherActivePlan}
          className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
            isHighlighted
              ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200 hover:shadow-rose-300'
              : 'bg-gray-900 hover:bg-gray-800 text-white'
          }`}
        >
          {fr ? 'Souscrire maintenant' : 'Subscribe now'}
        </CheckoutButton>
      )}
    </div>
  );
}