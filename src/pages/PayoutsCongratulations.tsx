import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, Clock, Calendar, ArrowRight, Home } from 'lucide-react';

export default function PayoutsCongratulations() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile?.role !== 'landlord') {
      navigate('/');
    }
  }, [profile, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6 animate-bounce">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-3">Félicitations !</h1>
            <p className="text-xl text-gray-600">
              Votre inscription Stripe Connect a été soumise avec succès
            </p>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-xl p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Que se passe-t-il maintenant ?</h2>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold mr-4">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Vérification en cours</h3>
                  <p className="text-sm text-gray-700">
                    Stripe examine actuellement les informations que vous avez fournies pour vérifier votre identité et votre compte bancaire.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold mr-4">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Délai de traitement : 24 à 48 heures
                  </h3>
                  <p className="text-sm text-gray-700">
                    La vérification prend généralement entre 24 et 48 heures. Dans certains cas exceptionnels, cela peut prendre quelques jours supplémentaires.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold mr-4">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Réception des paiements mensuels
                  </h3>
                  <p className="text-sm text-gray-700">
                    Une fois votre compte vérifié, vous pourrez recevoir vos paiements de loyers directement sur votre compte bancaire chaque mois.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <ArrowRight className="w-5 h-5" />
              Prochaines étapes
            </h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Vous recevrez un email de confirmation de Stripe une fois la vérification terminée</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Vous pouvez consulter le statut de votre compte à tout moment sur la page "Paiements"</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>En attendant, vous pouvez continuer à gérer vos annonces et répondre aux demandes de réservation</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <Link
              to="/proprietaire/paiements"
              className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              Voir le statut de mon compte
            </Link>

            <Link
              to="/mes-annonces"
              className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-xl font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              Gérer mes annonces
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
            <p className="text-sm text-gray-600">
              Si vous avez des questions ou si vous rencontrez des difficultés, n'hésitez pas à contacter notre support via le chat en bas à droite de l'écran.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
