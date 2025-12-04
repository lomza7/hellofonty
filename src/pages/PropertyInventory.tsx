import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Home, FileText, Calendar, Users, Plus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface Listing {
  id: string;
  title: string;
  address: string;
}

export default function PropertyInventory() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadListings();
  }, [user]);

  const loadListings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('listings')
        .select('id, title, address')
        .eq('landlord_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setListings(data || []);
    } catch (error) {
      console.error('Error loading listings:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-600 to-emerald-700 px-6 py-8">
            <h1 className="text-3xl font-bold text-white">
              {language === 'fr' ? 'États des lieux en ligne' : 'Online Property Inventory'}
            </h1>
            <p className="text-green-100 mt-2">
              {language === 'fr'
                ? 'Créez et gérez vos états des lieux numériques avec signature électronique'
                : 'Create and manage your digital property inventories with electronic signature'}
            </p>
          </div>

          <div className="p-6">
            {/* En-tête avec statistiques */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-blue-50 p-6 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      {language === 'fr' ? 'Logements' : 'Properties'}
                    </p>
                    <p className="text-3xl font-bold text-blue-600">{listings.length}</p>
                  </div>
                  <Home className="w-12 h-12 text-blue-600 opacity-20" />
                </div>
              </div>

              <div className="bg-green-50 p-6 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      {language === 'fr' ? 'États des lieux' : 'Inventories'}
                    </p>
                    <p className="text-3xl font-bold text-green-600">0</p>
                  </div>
                  <FileText className="w-12 h-12 text-green-600 opacity-20" />
                </div>
              </div>

              <div className="bg-purple-50 p-6 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">
                      {language === 'fr' ? 'En attente de signature' : 'Awaiting Signature'}
                    </p>
                    <p className="text-3xl font-bold text-purple-600">0</p>
                  </div>
                  <Users className="w-12 h-12 text-purple-600 opacity-20" />
                </div>
              </div>
            </div>

            {/* Section principale - Coming Soon */}
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full mb-6">
                <FileText className="w-12 h-12 text-green-600" />
              </div>

              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                {language === 'fr' ? 'Fonctionnalité en développement' : 'Feature in Development'}
              </h2>

              <div className="max-w-2xl mx-auto mb-8">
                <p className="text-lg text-gray-600 mb-4">
                  {language === 'fr'
                    ? 'Cette fonctionnalité permettra de créer des états des lieux numériques complets avec :'
                    : 'This feature will allow you to create comprehensive digital property inventories with:'}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                      </div>
                      <div className="ml-3">
                        <p className="font-medium text-gray-900">
                          {language === 'fr' ? 'État des lieux d\'entrée et de sortie' : 'Check-in and check-out inventories'}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {language === 'fr'
                            ? 'Documentation complète de l\'état du logement'
                            : 'Complete documentation of property condition'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                      </div>
                      <div className="ml-3">
                        <p className="font-medium text-gray-900">
                          {language === 'fr' ? 'Photos et annotations' : 'Photos and annotations'}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {language === 'fr'
                            ? 'Ajoutez des photos avec commentaires pour chaque pièce'
                            : 'Add photos with comments for each room'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                      </div>
                      <div className="ml-3">
                        <p className="font-medium text-gray-900">
                          {language === 'fr' ? 'Signature électronique' : 'Electronic signature'}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {language === 'fr'
                            ? 'Signature légale en ligne par toutes les parties'
                            : 'Legal online signature by all parties'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                      </div>
                      <div className="ml-3">
                        <p className="font-medium text-gray-900">
                          {language === 'fr' ? 'Historique et archivage' : 'History and archiving'}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {language === 'fr'
                            ? 'Conservation sécurisée de tous vos documents'
                            : 'Secure storage of all your documents'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                      </div>
                      <div className="ml-3">
                        <p className="font-medium text-gray-900">
                          {language === 'fr' ? 'Modèles personnalisables' : 'Customizable templates'}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {language === 'fr'
                            ? 'Créez vos propres modèles d\'état des lieux'
                            : 'Create your own inventory templates'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                      </div>
                      <div className="ml-3">
                        <p className="font-medium text-gray-900">
                          {language === 'fr' ? 'Export PDF' : 'PDF Export'}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {language === 'fr'
                            ? 'Téléchargez vos états des lieux en PDF'
                            : 'Download your inventories as PDF'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <button
                  disabled
                  className="inline-flex items-center px-8 py-4 bg-gray-300 text-gray-500 rounded-xl font-semibold cursor-not-allowed"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  {language === 'fr' ? 'Créer un état des lieux' : 'Create Inventory'}
                </button>
              </div>

              <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6 max-w-2xl mx-auto">
                <div className="flex items-start">
                  <Calendar className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" />
                  <div className="ml-4 text-left">
                    <p className="font-semibold text-blue-900 mb-2">
                      {language === 'fr' ? 'Prochainement disponible' : 'Coming Soon'}
                    </p>
                    <p className="text-sm text-blue-700">
                      {language === 'fr'
                        ? 'Cette fonctionnalité est actuellement en développement et sera disponible très prochainement. Vous serez notifié dès son lancement.'
                        : 'This feature is currently under development and will be available very soon. You will be notified upon launch.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
