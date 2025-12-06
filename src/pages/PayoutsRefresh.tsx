import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, ArrowRight, Home } from 'lucide-react';

export default function PayoutsRefresh() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (profile?.role !== 'landlord') {
      navigate('/');
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          navigate('/proprietaire/paiements');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [profile, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-50 py-12 px-4 flex items-center justify-center">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Inscription interrompue
            </h1>
            <p className="text-gray-600">
              Vous avez quitté le processus d'inscription Stripe
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-6 text-center">
            <p className="text-yellow-900 mb-2">
              Redirection vers la page des paiements...
            </p>
            <p className="text-3xl font-bold text-yellow-600">
              {countdown}
            </p>
          </div>

          <div className="space-y-3">
            <Link
              to="/proprietaire/paiements"
              className="w-full bg-yellow-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-yellow-700 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-5 h-5" />
              Retourner maintenant
            </Link>

            <Link
              to="/"
              className="w-full text-center py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Retour à l'accueil
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
