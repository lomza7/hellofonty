import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MapPin, Key, Wifi, Home, Image as ImageIcon, Video, AlertCircle } from 'lucide-react';

interface AccessGuide {
  id: string;
  listing_id: string;
  access_type: string;
  access_instructions: string;
  wifi_ssid: string;
  wifi_password: string;
  parking_info: string;
  additional_info: string;
  access_photos: string[];
  access_video: string;
  listing?: {
    title: string;
    address: string;
  };
}

interface AccessGuidePreviewProps {
  token: string;
}

export default function AccessGuidePreview({ token }: AccessGuidePreviewProps) {
  const [guide, setGuide] = useState<AccessGuide | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadGuide();
  }, [token]);

  const loadGuide = async () => {
    try {
      const { data, error } = await supabase
        .from('access_guides')
        .select(`
          *,
          listing:listings(title, address)
        `)
        .eq('share_token', token)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setError(true);
      } else {
        setGuide(data);
      }
    } catch (err) {
      console.error('Error loading guide:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du guide d'accès...</p>
        </div>
      </div>
    );
  }

  if (error || !guide) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Guide non trouvé</h1>
          <p className="text-gray-600">
            Ce lien n'est plus valide ou le guide d'accès n'existe plus.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center mb-4">
            <Key className="w-12 h-12" />
          </div>
          <h1 className="text-3xl font-bold text-center mb-2">Guide d'accès au logement</h1>
          {guide.listing && (
            <>
              <p className="text-xl text-center text-blue-100 font-medium">{guide.listing.title}</p>
              <p className="text-center text-blue-100 mt-2 flex items-center justify-center">
                <MapPin className="w-4 h-4 mr-2" />
                {guide.listing.address}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 space-y-8">
            {/* Type d'accès */}
            <div>
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <Key className="w-6 h-6 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Type d'accès</h2>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-gray-800 font-medium">
                  {guide.access_type === 'key_box' && '🔑 Boîte à clés'}
                  {guide.access_type === 'in_person' && '👤 Remise en main propre'}
                  {guide.access_type === 'other' && '🏠 Autre'}
                </p>
              </div>
            </div>

            {/* Instructions détaillées */}
            <div>
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                  <Home className="w-6 h-6 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Instructions d'accès</h2>
              </div>
              <div className="bg-gray-50 rounded-xl p-6">
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {guide.access_instructions}
                </p>
              </div>
            </div>

            {/* Photos d'accès */}
            {guide.access_photos && guide.access_photos.length > 0 && (
              <div>
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                    <ImageIcon className="w-6 h-6 text-purple-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Photos de l'entrée</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {guide.access_photos.map((photo, index) => (
                    <div key={index} className="relative aspect-square rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow">
                      <img
                        src={photo}
                        alt={`Photo d'accès ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vidéo d'accès */}
            {guide.access_video && (
              <div>
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                    <Video className="w-6 h-6 text-red-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Vidéo du trajet</h2>
                </div>
                <div className="rounded-xl overflow-hidden shadow-md">
                  <video
                    src={guide.access_video}
                    controls
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {/* Informations WiFi */}
            {guide.wifi_ssid && (
              <div>
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center mr-3">
                    <Wifi className="w-6 h-6 text-cyan-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Informations WiFi</h2>
                </div>
                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Nom du réseau (SSID)</p>
                      <p className="text-lg font-semibold text-gray-900 bg-white rounded-lg px-4 py-3">
                        {guide.wifi_ssid}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Mot de passe</p>
                      <p className="text-lg font-semibold text-gray-900 bg-white rounded-lg px-4 py-3 font-mono">
                        {guide.wifi_password}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stationnement */}
            {guide.parking_info && (
              <div>
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-2xl">🅿️</span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Stationnement</h2>
                </div>
                <div className="bg-orange-50 rounded-xl p-6">
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {guide.parking_info}
                  </p>
                </div>
              </div>
            )}

            {/* Informations additionnelles */}
            {guide.additional_info && (
              <div>
                <div className="flex items-center mb-4">
                  <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-2xl">ℹ️</span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Informations supplémentaires</h2>
                </div>
                <div className="bg-yellow-50 rounded-xl p-6">
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {guide.additional_info}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-600">
          <p className="flex items-center justify-center">
            <span className="mr-2">📱</span>
            Sauvegardez ce lien pour y accéder à tout moment
          </p>
          <p className="mt-2 text-sm">
            Propulsé par <span className="font-semibold text-blue-600">Flatinbleau</span>
          </p>
        </div>
      </div>
    </div>
  );
}
