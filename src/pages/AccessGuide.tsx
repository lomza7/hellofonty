import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Home, Upload, Wifi, Car, Video, Image as ImageIcon, Key, User, Save, Trash2, Share2, Copy, Check, ExternalLink, Eye } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import AccessGuidePreviewModal from '../components/AccessGuidePreviewModal';

interface Listing {
  id: string;
  title: string;
  address: string;
  images: string[];
}

interface ListingWithGuide extends Listing {
  hasGuide: boolean;
  shareToken?: string;
}

interface AccessGuide {
  id?: string;
  listing_id: string;
  access_type: 'boite_a_cles' | 'remise_en_main_propre' | 'autre';
  access_instructions: string;
  wifi_ssid: string;
  wifi_password: string;
  parking_info: string;
  access_photos: string[];
  access_video: string;
  additional_info: string;
  share_token?: string;
}

export default function AccessGuide() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [listings, setListings] = useState<ListingWithGuide[]>([]);
  const [selectedListing, setSelectedListing] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [formData, setFormData] = useState<AccessGuide>({
    listing_id: '',
    access_type: 'boite_a_cles',
    access_instructions: '',
    wifi_ssid: '',
    wifi_password: '',
    parking_info: '',
    access_photos: [],
    access_video: '',
    additional_info: ''
  });

  useEffect(() => {
    loadListings();
  }, [user]);

  useEffect(() => {
    if (selectedListing) {
      loadAccessGuide(selectedListing);
    }
  }, [selectedListing]);

  const loadListings = async () => {
    if (!user) return;

    try {
      const { data: listingsData, error: listingsError } = await supabase
        .from('listings')
        .select(`
          id,
          title,
          address,
          listing_images(image_url)
        `)
        .eq('landlord_id', user.id)
        .order('created_at', { ascending: false });

      if (listingsError) throw listingsError;

      if (!listingsData || listingsData.length === 0) {
        setListings([]);
        return;
      }

      const { data: guidesData, error: guidesError } = await supabase
        .from('access_guides')
        .select('listing_id, share_token')
        .in('listing_id', listingsData.map(l => l.id));

      if (guidesError) throw guidesError;

      const guidesMap = new Map(
        (guidesData || []).map(g => [g.listing_id, g.share_token])
      );

      const listingsWithGuides: ListingWithGuide[] = listingsData.map(listing => ({
        id: listing.id,
        title: listing.title,
        address: listing.address,
        images: (listing.listing_images || []).map((img: any) => img.image_url),
        hasGuide: guidesMap.has(listing.id),
        shareToken: guidesMap.get(listing.id)
      }));

      setListings(listingsWithGuides);
    } catch (error) {
      console.error('Error loading listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAccessGuide = async (listingId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('access_guides')
        .select('*')
        .eq('listing_id', listingId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setFormData({
          id: data.id,
          listing_id: data.listing_id,
          access_type: data.access_type || 'boite_a_cles',
          access_instructions: data.access_instructions || '',
          wifi_ssid: data.wifi_ssid || '',
          wifi_password: data.wifi_password || '',
          parking_info: data.parking_info || '',
          access_photos: data.access_photos || [],
          access_video: data.access_video || '',
          additional_info: data.additional_info || ''
        });
      } else {
        setFormData({
          listing_id: listingId,
          access_type: 'boite_a_cles',
          access_instructions: '',
          wifi_ssid: '',
          wifi_password: '',
          parking_info: '',
          access_photos: [],
          access_video: '',
          additional_info: ''
        });
      }
    } catch (error) {
      console.error('Error loading access guide:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !selectedListing || !user) return;

    setUploadingPhotos(true);
    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/access_guide_${selectedListing}_${Date.now()}_${i}.${fileExt}`;

        const { error: uploadError, data } = await supabase.storage
          .from('images')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('images')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      setFormData(prev => ({
        ...prev,
        access_photos: [...prev.access_photos, ...uploadedUrls]
      }));
    } catch (error) {
      console.error('Error uploading photos:', error);
      alert('Erreur lors de l\'upload des photos');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !selectedListing || !user) return;

    setUploadingVideo(true);
    try {
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/access_video_${selectedListing}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, access_video: publicUrl }));
    } catch (error) {
      console.error('Error uploading video:', error);
      alert('Erreur lors de l\'upload de la vidéo');
    } finally {
      setUploadingVideo(false);
    }
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      access_photos: prev.access_photos.filter((_, i) => i !== index)
    }));
  };

  const generateToken = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const handleSave = async () => {
    if (!selectedListing) return;

    setSaving(true);
    try {
      const shareToken = formData.share_token || generateToken();

      const dataToSave = {
        listing_id: selectedListing,
        access_type: formData.access_type,
        access_instructions: formData.access_instructions,
        wifi_ssid: formData.wifi_ssid,
        wifi_password: formData.wifi_password,
        parking_info: formData.parking_info,
        access_photos: formData.access_photos,
        access_video: formData.access_video,
        additional_info: formData.additional_info,
        share_token: shareToken,
        updated_at: new Date().toISOString()
      };

      if (formData.id) {
        const { error } = await supabase
          .from('access_guides')
          .update(dataToSave)
          .eq('id', formData.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('access_guides')
          .insert([dataToSave]);

        if (error) throw error;
      }

      alert('Guide d\'accès enregistré avec succès!');
      loadAccessGuide(selectedListing);
      loadListings();
    } catch (error) {
      console.error('Error saving access guide:', error);
      alert('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const copyShareLink = (token: string, listingId?: string) => {
    if (!token) return;

    const shareUrl = `${window.location.origin}/partage/${token}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(listingId || 'form');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleListingSelect = (listingId: string) => {
    setSelectedListing(listingId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading && listings.length === 0) {
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
      <div className={`${selectedListing ? 'max-w-4xl' : 'max-w-7xl'} mx-auto px-4 sm:px-6 lg:px-8`}>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8">
            <h1 className="text-3xl font-bold text-white">
              Guide d'accès au logement
            </h1>
            <p className="text-blue-100 mt-2">
              Créez un guide complet pour faciliter l'arrivée de vos locataires
            </p>
          </div>

          <div className="p-6 space-y-8">
            {!selectedListing ? (
              <>
                {/* Header de sélection */}
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center">
                    <Home className="w-5 h-5 mr-2 text-blue-600" />
                    Sélectionnez un logement
                  </h2>
                  <p className="text-gray-600 text-sm">
                    Cliquez sur un logement pour créer ou modifier son guide d'accès
                  </p>
                </div>

                {/* Grille de cartes de logements */}
                {listings.length === 0 ? (
                  <div className="text-center py-12">
                    <Home className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">Aucun logement trouvé</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Ajoutez d'abord un logement pour créer un guide d'accès
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {listings.map((listing) => (
                      <div
                        key={listing.id}
                        className="group bg-white rounded-xl border-2 border-gray-200 overflow-hidden hover:border-blue-400 hover:shadow-lg transition-all duration-300 cursor-pointer"
                        onClick={() => handleListingSelect(listing.id)}
                      >
                        {/* Image du logement */}
                        <div className="relative h-48 bg-gray-200 overflow-hidden">
                          {listing.images && listing.images.length > 0 ? (
                            <img
                              src={listing.images[0]}
                              alt={listing.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                              <Home className="w-16 h-16 text-gray-400" />
                            </div>
                          )}

                          {/* Badge statut */}
                          <div className="absolute top-3 right-3">
                            {listing.hasGuide ? (
                              <span className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-lg flex items-center">
                                <Check className="w-3 h-3 mr-1" />
                                Guide créé
                              </span>
                            ) : (
                              <span className="bg-orange-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-lg">
                                À créer
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Informations */}
                        <div className="p-4">
                          <h3 className="font-bold text-gray-900 text-lg mb-2 line-clamp-1 group-hover:text-blue-600 transition-colors">
                            {listing.title}
                          </h3>
                          <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                            {listing.address}
                          </p>

                          {/* Actions */}
                          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                            {listing.hasGuide && listing.shareToken ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyShareLink(listing.shareToken!, listing.id);
                                }}
                                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                              >
                                {copied === listing.id ? (
                                  <>
                                    <Check className="w-4 h-4" />
                                    Copié !
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4" />
                                    Copier le lien
                                  </>
                                )}
                              </button>
                            ) : (
                              <div className="text-sm text-gray-500 flex items-center">
                                <Key className="w-4 h-4 mr-1" />
                                Créer le guide
                              </div>
                            )}
                            <span className="text-blue-600 group-hover:translate-x-1 transition-transform">
                              →
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Bouton retour */}
                <button
                  onClick={() => {
                    setSelectedListing('');
                    setFormData({
                      listing_id: '',
                      access_type: 'boite_a_cles',
                      access_instructions: '',
                      wifi_ssid: '',
                      wifi_password: '',
                      parking_info: '',
                      access_photos: [],
                      access_video: '',
                      additional_info: ''
                    });
                  }}
                  className="flex items-center text-blue-600 hover:text-blue-700 font-medium"
                >
                  ← Retour à la liste des logements
                </button>
              </>
            )}

            {selectedListing && (
              <>
                {/* Section Guide d'accès */}
                <div className="border-t pt-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                    <Key className="w-6 h-6 mr-3 text-blue-600" />
                    Guide d'accès au logement
                  </h2>

                  {/* Type d'accès */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Type d'accès *
                    </label>
                    <div className="space-y-3">
                      <label className="flex items-center p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="radio"
                          name="access_type"
                          value="boite_a_cles"
                          checked={formData.access_type === 'boite_a_cles'}
                          onChange={(e) => setFormData(prev => ({ ...prev, access_type: e.target.value as any }))}
                          className="w-4 h-4 text-blue-600"
                        />
                        <Key className="w-5 h-5 mx-3 text-gray-600" />
                        <span className="font-medium text-gray-900">Boîte à clés</span>
                      </label>
                      <label className="flex items-center p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="radio"
                          name="access_type"
                          value="remise_en_main_propre"
                          checked={formData.access_type === 'remise_en_main_propre'}
                          onChange={(e) => setFormData(prev => ({ ...prev, access_type: e.target.value as any }))}
                          className="w-4 h-4 text-blue-600"
                        />
                        <User className="w-5 h-5 mx-3 text-gray-600" />
                        <span className="font-medium text-gray-900">Remise en main propre</span>
                      </label>
                      <label className="flex items-center p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="radio"
                          name="access_type"
                          value="autre"
                          checked={formData.access_type === 'autre'}
                          onChange={(e) => setFormData(prev => ({ ...prev, access_type: e.target.value as any }))}
                          className="w-4 h-4 text-blue-600"
                        />
                        <Home className="w-5 h-5 mx-3 text-gray-600" />
                        <span className="font-medium text-gray-900">Autre</span>
                      </label>
                    </div>
                  </div>

                  {/* Instructions d'accès */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Instructions détaillées d'accès *
                    </label>
                    <textarea
                      value={formData.access_instructions}
                      onChange={(e) => setFormData(prev => ({ ...prev, access_instructions: e.target.value }))}
                      rows={6}
                      placeholder="Décrivez précisément comment accéder au logement : étage, code d'entrée, emplacement de la boîte à clés, etc."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Photos d'accès */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <ImageIcon className="inline-block w-4 h-4 mr-2" />
                      Photos d'accès
                    </label>
                    <p className="text-sm text-gray-500 mb-3">
                      Ajoutez des photos de l'entrée, de la boîte à clés, du bâtiment, etc.
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                      {formData.access_photos.map((photo, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={photo}
                            alt={`Photo ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg"
                          />
                          <button
                            onClick={() => removePhoto(index)}
                            className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                      <Upload className="w-5 h-5 mr-2 text-gray-600" />
                      <span className="text-gray-600">
                        {uploadingPhotos ? 'Upload en cours...' : 'Ajouter des photos'}
                      </span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        disabled={uploadingPhotos}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Vidéo d'accès */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Video className="inline-block w-4 h-4 mr-2" />
                      Vidéo d'accès
                    </label>
                    <p className="text-sm text-gray-500 mb-3">
                      Filmez le trajet depuis l'entrée du bâtiment jusqu'au logement
                    </p>

                    {formData.access_video && (
                      <div className="mb-4">
                        <video
                          src={formData.access_video}
                          controls
                          className="w-full rounded-lg"
                        />
                        <button
                          onClick={() => setFormData(prev => ({ ...prev, access_video: '' }))}
                          className="mt-2 text-red-600 hover:text-red-700 text-sm"
                        >
                          Supprimer la vidéo
                        </button>
                      </div>
                    )}

                    <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                      <Upload className="w-5 h-5 mr-2 text-gray-600" />
                      <span className="text-gray-600">
                        {uploadingVideo ? 'Upload en cours...' : (formData.access_video ? 'Remplacer la vidéo' : 'Ajouter une vidéo')}
                      </span>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleVideoUpload}
                        disabled={uploadingVideo}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* WiFi */}
                  <div className="mb-6 bg-blue-50 p-6 rounded-xl">
                    <label className="block text-sm font-medium text-gray-700 mb-4">
                      <Wifi className="inline-block w-5 h-5 mr-2 text-blue-600" />
                      Informations WiFi
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Nom du réseau (SSID)
                        </label>
                        <input
                          type="text"
                          value={formData.wifi_ssid}
                          onChange={(e) => setFormData(prev => ({ ...prev, wifi_ssid: e.target.value }))}
                          placeholder="MonWiFi"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Mot de passe
                        </label>
                        <input
                          type="text"
                          value={formData.wifi_password}
                          onChange={(e) => setFormData(prev => ({ ...prev, wifi_password: e.target.value }))}
                          placeholder="••••••••"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stationnement */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Car className="inline-block w-4 h-4 mr-2" />
                      Informations sur le stationnement
                    </label>
                    <textarea
                      value={formData.parking_info}
                      onChange={(e) => setFormData(prev => ({ ...prev, parking_info: e.target.value }))}
                      rows={4}
                      placeholder="Parking gratuit dans la rue, places visiteurs dans la cour, garage privé, etc."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Informations additionnelles */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Informations additionnelles
                    </label>
                    <textarea
                      value={formData.additional_info}
                      onChange={(e) => setFormData(prev => ({ ...prev, additional_info: e.target.value }))}
                      rows={4}
                      placeholder="Autres informations utiles : interphone, code portail, consignes particulières, etc."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>
                </div>

                {/* Section Partage du lien */}
                {formData.id && formData.share_token && (
                  <div className="border-t pt-6">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6">
                      <div className="flex items-center mb-4">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                          <Share2 className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">Lien de partage</h3>
                          <p className="text-sm text-gray-600">Partagez ce lien avec vos locataires</p>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 mb-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 overflow-hidden">
                            <p className="text-sm text-gray-500 mb-1">Lien public du guide</p>
                            <p className="text-sm font-mono text-blue-600 truncate">
                              {`${window.location.origin}/partage/${formData.share_token}`}
                            </p>
                          </div>
                          <button
                            onClick={() => copyShareLink(formData.share_token!, 'form')}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                          >
                            {copied === 'form' ? (
                              <>
                                <Check className="w-4 h-4 mr-2" />
                                Copié !
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4 mr-2" />
                                Copier
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowPreviewModal(true)}
                          className="flex items-center px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Prévisualiser
                        </button>
                        <a
                          href={`?share=${formData.share_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Ouvrir dans un nouvel onglet
                        </a>
                      </div>

                      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                          💡 <strong>Astuce :</strong> Ce lien peut être partagé directement dans la messagerie avec vos locataires ou envoyé par email/SMS.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Boutons d'action */}
                <div className="flex justify-between items-center pt-6 border-t">
                  <button
                    onClick={() => setShowPreviewModal(true)}
                    disabled={!formData.access_instructions}
                    className="flex items-center px-6 py-3 bg-white text-gray-700 border-2 border-gray-300 rounded-xl hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    <Eye className="w-5 h-5 mr-2" />
                    Prévisualiser
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !formData.access_instructions}
                    className="flex items-center px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    <Save className="w-5 h-5 mr-2" />
                    {saving ? 'Enregistrement...' : 'Enregistrer le guide'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <AccessGuidePreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        guide={formData}
        listingTitle={listings.find(l => l.id === selectedListing)?.title}
        listingAddress={listings.find(l => l.id === selectedListing)?.address}
      />
    </div>
  );
}
