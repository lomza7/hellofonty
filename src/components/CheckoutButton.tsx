import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createCheckoutSession } from '../utils/checkout';
import { StripeProduct } from '../stripe-config';

interface CheckoutButtonProps {
  product: StripeProduct;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export default function CheckoutButton({
  product,
  className = '',
  children,
  disabled = false,
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCheckout() {
    setLoading(true);
    setError('');
    try {
      const url = await createCheckoutSession({
        priceId: product.priceId,
        mode: product.mode,
      });
      window.location.href = url;
    } catch (err: any) {
      setError(err.message ?? 'Une erreur est survenue.');
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <button
        onClick={handleCheckout}
        disabled={loading || disabled}
        className={`flex items-center justify-center gap-2 ${className} disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Redirection...</span>
          </>
        ) : (
          children
        )}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600 text-center">{error}</p>
      )}
    </div>
  );
}