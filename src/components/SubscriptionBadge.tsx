import { Crown, Loader2 } from 'lucide-react';
import { useStripeSubscription } from '../hooks/useStripeSubscription';
import { useLanguage } from '../contexts/LanguageContext';

export default function SubscriptionBadge() {
  const { isActive, product, loading } = useStripeSubscription();
  const { language } = useLanguage();

  if (loading) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full">
        <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isActive || !product) return null;

  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 border border-amber-200 rounded-full">
      <Crown className="w-3.5 h-3.5 text-amber-600" />
      <span className="text-xs font-semibold text-amber-700">
        {language === 'fr' ? product.name : product.nameEn}
      </span>
    </div>
  );
}