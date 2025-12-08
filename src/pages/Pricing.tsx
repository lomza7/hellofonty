import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface PricingPlan {
  id: string;
  name: string;
  name_en?: string;
  type: 'landlord' | 'student';
  plan_category: 'subscription' | 'booking_fee';
  price: number;
  billing_period: 'monthly' | 'yearly' | 'one_time';
  features: string[];
  features_en?: string[];
  is_active: boolean;
  display_order: number;
}

interface ComparisonFeature {
  id: string;
  feature_fr: string;
  feature_en: string;
  hellofonty_has: boolean;
  hellofonty_details_fr: string | null;
  hellofonty_details_en: string | null;
  agency_has: boolean;
  agency_details_fr: string | null;
  agency_details_en: string | null;
  order_index: number;
}

export default function Pricing() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [comparisonFeatures, setComparisonFeatures] = useState<ComparisonFeature[]>([]);
  const [loading, setLoading] = useState(true);

  const isFrench = language === 'fr';

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [plansResult, featuresResult] = await Promise.all([
        supabase
          .from('pricing_plans')
          .select('*')
          .eq('is_active', true)
          .order('type', { ascending: true })
          .order('display_order', { ascending: true }),
        supabase
          .from('agency_comparison_features')
          .select('*')
          .eq('is_active', true)
          .order('order_index', { ascending: true })
      ]);

      if (plansResult.error) throw plansResult.error;
      if (featuresResult.error) throw featuresResult.error;

      setPlans(plansResult.data || []);
      setComparisonFeatures(featuresResult.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  const landlordPlans = plans.filter(p => p.type === 'landlord');
  const studentPlans = plans.filter(p => p.type === 'student');

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-20 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            {isFrench ? 'Nos Tarifs' : 'Our Pricing'}
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {isFrench
              ? 'Des solutions transparentes et adaptées à vos besoins'
              : 'Transparent solutions adapted to your needs'}
          </p>
        </div>

        {/* Section Propriétaires */}
        <div className="mb-24">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              {isFrench ? 'Pour les Propriétaires' : 'For Landlords'}
            </h2>
            <p className="text-lg text-gray-600">
              {isFrench
                ? 'Choisissez l\'option qui correspond à vos besoins'
                : 'Choose the option that fits your needs'}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {landlordPlans.map((plan, index) => {
              const isPremium = index === 1;
              const bgColor = isPremium ? 'bg-rose-500 text-white' : 'bg-white border-2 border-gray-200';
              const textColor = isPremium ? 'text-white' : 'text-gray-900';
              const descColor = isPremium ? 'text-white/90' : 'text-gray-600';
              const badgeBg = isPremium ? 'bg-white/20 backdrop-blur-sm text-white' : 'bg-gray-100 text-gray-700';
              const checkBg = isPremium ? 'bg-white/20 backdrop-blur-sm' : 'bg-gray-100';
              const checkColor = isPremium ? 'text-white' : 'text-gray-700';
              const buttonClass = isPremium
                ? 'w-full py-4 bg-white text-rose-500 rounded-full font-semibold hover:bg-gray-50 transition'
                : 'w-full py-4 bg-gray-900 text-white rounded-full font-semibold hover:bg-gray-800 transition';

              const billingText = plan.billing_period === 'monthly'
                ? (isFrench ? '/ mois' : '/ month')
                : plan.billing_period === 'yearly'
                ? (isFrench ? '/ an' : '/ year')
                : (isFrench ? 'unique' : 'one-time');

              return (
                <div key={plan.id} className={`${bgColor} rounded-3xl p-8 hover:shadow-2xl transition-all hover:scale-105 relative`}>
                  {isPremium && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="bg-gray-900 text-white px-6 py-2 rounded-full text-sm font-bold">
                        {isFrench ? 'POPULAIRE' : 'POPULAR'}
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <div className={`inline-block px-4 py-2 ${badgeBg} rounded-full text-sm font-semibold mb-4`}>
                      {isFrench ? 'Propriétaires' : 'Landlords'}
                    </div>
                    <h2 className={`text-3xl font-bold ${textColor} mb-2`}>
                      {isFrench ? plan.name : (plan.name_en || plan.name)}
                    </h2>
                    <div className="flex items-baseline mb-6">
                      <span className={`text-5xl font-bold ${textColor}`}>{plan.price}€</span>
                      <span className={`${descColor} ml-2`}>
                        {billingText}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4 mb-8">
                    {(isFrench ? plan.features : (plan.features_en || plan.features)).map((feature, idx) => (
                      <div key={idx} className="flex items-start space-x-3">
                        <div className={`flex-shrink-0 w-6 h-6 ${checkBg} rounded-full flex items-center justify-center mt-0.5`}>
                          <Check className={`h-4 w-4 ${checkColor}`} />
                        </div>
                        <span className={checkColor}>{feature}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => navigate(user ? '/mon-abonnement' : '/inscription')}
                    className={buttonClass}
                  >
                    {isPremium
                      ? (isFrench ? 'Choisir Premium' : 'Choose Premium')
                      : (isFrench ? 'Commencer gratuitement' : 'Start for free')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section Étudiants */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              {isFrench ? 'Pour les Étudiants' : 'For Students'}
            </h2>
            <p className="text-lg text-gray-600">
              {isFrench
                ? 'Un tarif unique pour accéder à tous nos logements'
                : 'One fixed fee to access all our accommodations'}
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            {studentPlans.map((plan) => {
              const billingText = plan.billing_period === 'monthly'
                ? (isFrench ? '/ mois' : '/ month')
                : plan.billing_period === 'yearly'
                ? (isFrench ? '/ an' : '/ year')
                : (isFrench ? 'unique' : 'one-time');

              return (
                <div key={plan.id} className="bg-white border-2 border-gray-200 rounded-3xl p-8 hover:shadow-2xl transition-all hover:scale-105">
                  <div className="mb-6">
                    <div className="inline-block px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-semibold mb-4">
                      {isFrench ? 'Étudiants' : 'Students'}
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                      {isFrench ? plan.name : (plan.name_en || plan.name)}
                    </h2>
                    <div className="flex items-baseline mb-6">
                      <span className="text-5xl font-bold text-gray-900">{plan.price}€</span>
                      <span className="text-gray-600 ml-2">
                        {billingText}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4 mb-8">
                    {(isFrench ? plan.features : (plan.features_en || plan.features)).map((feature, idx) => (
                      <div key={idx} className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center mt-0.5">
                          <Check className="h-4 w-4 text-gray-700" />
                        </div>
                        <span className="text-gray-700">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => navigate(user ? '/recherche' : '/inscription')}
                    className="w-full py-4 bg-gray-900 text-white rounded-full font-semibold hover:bg-gray-800 transition"
                  >
                    {isFrench ? 'Commencer la recherche' : 'Start searching'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section Comparaison avec agences immobilières */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              {isFrench ? 'Pourquoi choisir Hellofonty ?' : 'Why choose Hellofonty?'}
            </h2>
            <p className="text-lg text-gray-600">
              {isFrench
                ? 'Comparez nos services avec les agences immobilières traditionnelles'
                : 'Compare our services with traditional real estate agencies'}
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl overflow-hidden max-w-5xl mx-auto border-2 border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-900">
                    <th className="px-6 py-5 text-left text-white font-semibold w-1/2">
                      {isFrench ? 'Critères' : 'Criteria'}
                    </th>
                    <th className="px-6 py-5 text-center text-white font-semibold w-1/4">
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-bold text-rose-400">Hellofonty</span>
                      </div>
                    </th>
                    <th className="px-6 py-5 text-center text-gray-300 font-medium w-1/4">
                      {isFrench ? 'Agences Immobilières' : 'Real Estate Agencies'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((feature, index) => (
                    <tr
                      key={feature.id}
                      className={`${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      } ${
                        index === comparisonFeatures.length - 1 ? '' : 'border-b border-gray-100'
                      } hover:bg-gray-50 transition`}
                    >
                      <td className="px-6 py-4 text-gray-800 font-medium">
                        {isFrench ? feature.feature_fr : feature.feature_en}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          {feature.hellofonty_has ? (
                            <Check className="h-6 w-6 text-green-600 mb-1" />
                          ) : (
                            <X className="h-6 w-6 text-red-400 mb-1" />
                          )}
                          {(isFrench ? feature.hellofonty_details_fr : feature.hellofonty_details_en) && (
                            <span className="text-sm text-gray-600 font-semibold">
                              {isFrench ? feature.hellofonty_details_fr : feature.hellofonty_details_en}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          {feature.agency_has ? (
                            <Check className="h-6 w-6 text-green-600 mb-1" />
                          ) : (
                            <X className="h-6 w-6 text-red-400 mb-1" />
                          )}
                          {(isFrench ? feature.agency_details_fr : feature.agency_details_en) && (
                            <span className="text-sm text-gray-600">
                              {isFrench ? feature.agency_details_fr : feature.agency_details_en}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-8 max-w-5xl mx-auto shadow-xl">
            <div className="text-center text-white">
              <h3 className="text-2xl font-bold mb-2">
                {isFrench ? 'Économisez jusqu\'à 1200€ !' : 'Save up to €1200!'}
              </h3>
              <p className="text-green-50">
                {isFrench
                  ? 'En moyenne, propriétaires et étudiants économisent ensemble 1200€ en frais d\'agence avec Hellofonty'
                  : 'On average, landlords and students together save €1200 in agency fees with Hellofonty'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-20 bg-gray-50 rounded-3xl p-12 text-center max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {isFrench ? 'Des questions sur nos tarifs ?' : 'Questions about pricing?'}
          </h2>
          <p className="text-gray-600 text-lg mb-8">
            {isFrench
              ? 'Notre équipe est là pour vous aider à choisir la meilleure option'
              : 'Our team is here to help you choose the best option'}
          </p>
          <button
            onClick={() => navigate(user ? '/messages' : '/inscription')}
            className="px-8 py-4 bg-rose-500 text-white rounded-full font-semibold hover:bg-rose-600 transition"
          >
            {isFrench ? 'Contactez-nous' : 'Contact us'}
          </button>
        </div>
      </div>
    </div>
  );
}
