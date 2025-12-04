import { X, MapPin, Key, Wifi, Home, Image as ImageIcon, Video } from 'lucide-react';

interface AccessGuide {
  access_type: 'boite_a_cles' | 'remise_en_main_propre' | 'autre';
  access_instructions: string;
  wifi_ssid: string;
  wifi_password: string;
  parking_info: string;
  access_photos: string[];
  access_video: string;
  additional_info: string;
}

interface AccessGuidePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  guide: AccessGuide;
  listingTitle?: string;
  listingAddress?: string;
}

export default function AccessGuidePreviewModal({
  isOpen,
  onClose,
  guide,
  listingTitle = 'Mon logement',
  listingAddress = ''
}: AccessGuidePreviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-900 bg-opacity-75" onClick={onClose}></div>

        <div className="inline-block w-full max-w-5xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-2xl rounded-2xl">
          <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center mb-3">
                  <Key className="w-8 h-8 mr-3" />
                  <h2 className="text-2xl font-bold">Prévisualisation du guide d'accès</h2>
                </div>
                <p className="text-xl text-blue-100 font-medium">{listingTitle}</p>
                {listingAddress && (
                  <p className="text-blue-100 mt-1 flex items-center">
                    <MapPin className="w-4 h-4 mr-2" />
                    {listingAddress}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="ml-4 p-2 hover:bg-blue-800 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
            <div className="space-y-8">
              {guide.access_type && (
                <div>
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                      <Key className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Type d'accès</h3>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4">
                    <p className="text-gray-800 font-medium">
                      {guide.access_type === 'boite_a_cles' && '🔑 Boîte à clés'}
                      {guide.access_type === 'remise_en_main_propre' && '👤 Remise en main propre'}
                      {guide.access_type === 'autre' && '🏠 Autre'}
                    </p>
                  </div>
                </div>
              )}

              {guide.access_instructions && (
                <div>
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                      <Home className="w-6 h-6 text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Instructions d'accès</h3>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-6">
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {guide.access_instructions}
                    </p>
                  </div>
                </div>
              )}

              {guide.access_photos && guide.access_photos.length > 0 && (
                <div>
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                      <ImageIcon className="w-6 h-6 text-purple-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Photos de l'entrée</h3>
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

              {guide.access_video && (
                <div>
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                      <Video className="w-6 h-6 text-red-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Vidéo du trajet</h3>
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

              {guide.wifi_ssid && (
                <div>
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center mr-3">
                      <Wifi className="w-6 h-6 text-cyan-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Informations WiFi</h3>
                  </div>
                  <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Nom du réseau (SSID)</p>
                        <p className="text-lg font-semibold text-gray-900 bg-white rounded-lg px-4 py-3">
                          {guide.wifi_ssid}
                        </p>
                      </div>
                      {guide.wifi_password && (
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Mot de passe</p>
                          <p className="text-lg font-semibold text-gray-900 bg-white rounded-lg px-4 py-3 font-mono">
                            {guide.wifi_password}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {guide.parking_info && (
                <div>
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-2xl">🅿️</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Stationnement</h3>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-6">
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {guide.parking_info}
                    </p>
                  </div>
                </div>
              )}

              {guide.additional_info && (
                <div>
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center mr-3">
                      <span className="text-2xl">ℹ️</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Informations supplémentaires</h3>
                  </div>
                  <div className="bg-yellow-50 rounded-xl p-6">
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {guide.additional_info}
                    </p>
                  </div>
                </div>
              )}

              {!guide.access_instructions && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Key className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600">
                    Le guide n'est pas encore complet. Ajoutez au moins les instructions d'accès pour pouvoir le partager.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
