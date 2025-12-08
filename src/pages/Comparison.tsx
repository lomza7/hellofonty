import { useEffect, useState } from 'react';
import { Check, X, TrendingDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import SEO from '../components/SEO';
import Breadcrumb from '../components/Breadcrumb';

interface ComparisonItem {
  id: string;
  feature_fr: string;
  feature_en: string;
  hellofonty: boolean;
  competitor_a: boolean;
  competitor_b: boolean;
  competitor_c: boolean;
  category: string;
  order_index: number;
  is_highlight: boolean;
}

interface CategoryGroup {
  category: string;
  items: ComparisonItem[];
}

export default function Comparison() {
  const { language } = useLanguage();
  const [items, setItems] = useState<ComparisonItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComparisonData();
  }, []);

  const loadComparisonData = async () => {
    try {
      const { data, error } = await supabase
        .from('comparison_items')
        .select('*')
        .order('category', { ascending: true })
        .order('order_index', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupedItems = items.reduce<CategoryGroup[]>((acc, item) => {
    const existingGroup = acc.find(g => g.category === item.category);
    if (existingGroup) {
      existingGroup.items.push(item);
    } else {
      acc.push({ category: item.category, items: [item] });
    }
    return acc;
  }, []);

  const getFeatureText = (item: ComparisonItem) => {
    return language === 'fr' ? item.feature_fr : item.feature_en;
  };

  const translations = {
    fr: {
      title: 'Hellofonty VS Concurrents',
      subtitle: 'Pourquoi choisir Hellofonty pour votre location à Fontainebleau ?',
      hellofonty: 'Hellofonty',
      competitorA: 'Leboncoin',
      competitorB: 'SeLoger',
      competitorC: 'Booking.com',
      savings: 'Économies',
      savingsText: 'En moyenne, les propriétaires économisent 800€ de frais d\'agence en utilisant Hellofonty',
      cta: 'Commencer gratuitement',
      loading: 'Chargement...',
    },
    en: {
      title: 'Hellofonty VS Competitors',
      subtitle: 'Why choose Hellofonty for your rental in Fontainebleau?',
      hellofonty: 'Hellofonty',
      competitorA: 'Leboncoin',
      competitorB: 'SeLoger',
      competitorC: 'Booking.com',
      savings: 'Savings',
      savingsText: 'On average, landlords save €800 in agency fees by using Hellofonty',
      cta: 'Get started for free',
      loading: 'Loading...',
    },
  };

  const t = translations[language];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">{t.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={t.title}
        description={t.subtitle}
      />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Breadcrumb
            items={[
              { label: language === 'fr' ? 'Accueil' : 'Home', href: '/' },
              { label: t.title },
            ]}
          />

          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              {t.title}
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              {t.subtitle}
            </p>
          </div>

          <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-8 mb-12 shadow-xl">
            <div className="flex items-center justify-center gap-4 text-white">
              <TrendingDown className="h-12 w-12" />
              <div>
                <h3 className="text-2xl font-bold mb-2">{t.savings}</h3>
                <p className="text-green-50">{t.savingsText}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-900">
                    <th className="px-6 py-4 text-left text-white font-semibold w-1/3">
                      {language === 'fr' ? 'Fonctionnalités' : 'Features'}
                    </th>
                    <th className="px-6 py-4 text-center text-white font-semibold w-1/6">
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-bold text-blue-400">{t.hellofonty}</span>
                      </div>
                    </th>
                    <th className="px-6 py-4 text-center text-slate-300 font-medium w-1/6">
                      {t.competitorA}
                    </th>
                    <th className="px-6 py-4 text-center text-slate-300 font-medium w-1/6">
                      {t.competitorB}
                    </th>
                    <th className="px-6 py-4 text-center text-slate-300 font-medium w-1/6">
                      {t.competitorC}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groupedItems.map((group, groupIndex) => (
                    <>
                      <tr key={`category-${groupIndex}`} className="bg-slate-100">
                        <td colSpan={5} className="px-6 py-3 text-sm font-semibold text-slate-700 uppercase tracking-wide">
                          {group.category}
                        </td>
                      </tr>
                      {group.items.map((item, itemIndex) => (
                        <tr
                          key={item.id}
                          className={`
                            ${itemIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                            ${item.is_highlight ? 'ring-2 ring-blue-400 ring-inset' : ''}
                            hover:bg-blue-50 transition-colors
                          `}
                        >
                          <td className="px-6 py-4 text-slate-800">
                            <div className="flex items-center gap-2">
                              {item.is_highlight && (
                                <span className="text-blue-600 font-semibold">★</span>
                              )}
                              {getFeatureText(item)}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {item.hellofonty ? (
                              <Check className="h-6 w-6 text-green-600 mx-auto" />
                            ) : (
                              <X className="h-6 w-6 text-red-400 mx-auto" />
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {item.competitor_a ? (
                              <Check className="h-6 w-6 text-green-600 mx-auto" />
                            ) : (
                              <X className="h-6 w-6 text-red-400 mx-auto" />
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {item.competitor_b ? (
                              <Check className="h-6 w-6 text-green-600 mx-auto" />
                            ) : (
                              <X className="h-6 w-6 text-red-400 mx-auto" />
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {item.competitor_c ? (
                              <Check className="h-6 w-6 text-green-600 mx-auto" />
                            ) : (
                              <X className="h-6 w-6 text-red-400 mx-auto" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-center mt-12">
            <a
              href="/auth"
              className="inline-block bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transform hover:scale-105 transition-all shadow-lg"
            >
              {t.cta}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
