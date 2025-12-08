import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';

interface FAQItem {
  id: string;
  question_fr: string;
  question_en: string;
  answer_fr: string;
  answer_en: string;
  display_order: number;
  category: string;
}

export default function FAQ() {
  const { t, language } = useLanguage();
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFAQs();
  }, []);

  async function loadFAQs() {
    try {
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setFaqs(data || []);
    } catch (error) {
      console.error('Error loading FAQs:', error);
    } finally {
      setLoading(false);
    }
  }

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  if (loading) {
    return null;
  }

  if (faqs.length === 0) {
    return null;
  }

  return (
    <div id="faq" className="bg-white py-12 sm:py-20">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-20">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-16 items-start">
          {/* Left side - Header with gradient background */}
          <div className="relative bg-gradient-to-br from-rose-500 via-rose-400 to-pink-500 rounded-3xl p-8 sm:p-12 text-white md:sticky md:top-24">
            <div className="relative z-10">
              <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider mb-3 sm:mb-4 opacity-90">
                FAQS
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 leading-tight">
                {language === 'fr' ? 'Questions Fréquemment Posées ?' : 'Frequently Asked Questions ?'}
              </h2>
              <p className="text-base sm:text-lg opacity-90 leading-relaxed">
                {language === 'fr'
                  ? 'Trouvez rapidement des réponses aux questions les plus courantes sur notre plateforme.'
                  : 'Quickly find answers to the most common questions about our platform.'}
              </p>
            </div>

            {/* Decorative circles */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden rounded-3xl">
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full"></div>
              <div className="absolute top-20 -right-5 w-32 h-32 bg-white/10 rounded-full"></div>
              <div className="absolute -bottom-10 left-20 w-48 h-48 bg-white/10 rounded-full"></div>
            </div>
          </div>

          {/* Right side - FAQ items */}
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={faq.id}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-rose-300 transition-all duration-200"
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 pr-4">
                    {language === 'fr' ? faq.question_fr : faq.question_en}
                  </h3>
                  <ChevronDown
                    className={`flex-shrink-0 w-5 h-5 text-rose-500 transition-transform duration-200 ${
                      openIndex === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    openIndex === index ? 'max-h-96' : 'max-h-0'
                  }`}
                >
                  <div className="px-6 pb-5 text-gray-600 leading-relaxed text-sm sm:text-base">
                    {language === 'fr' ? faq.answer_fr : faq.answer_en}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
