import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Image, Upload, Save, Trash2, Eye, EyeOff, AlertCircle, GripVertical, Plus } from 'lucide-react';

interface FeatureImage {
  id: string;
  feature_key: string;
  image_url: string;
  display_order: number;
  is_active: boolean;
  title_fr?: string;
  title_en?: string;
  description_fr?: string;
  description_en?: string;
  created_at: string;
  updated_at: string;
}

const featureLabels: Record<string, string> = {
  'landlords.lease': 'Baux et contrats',
  'landlords.payment': 'Paiements sécurisés',
  'landlords.inventory': 'État des lieux',
  'landlords.listings': 'Gestion des annonces',
  'landlords.bookings': 'Réservations',
  'landlords.access': 'Guide d\'accès',
  'landlords.verification': 'Vérification',
  'landlords.messaging': 'Messagerie',
  'landlords.stats': 'Statistiques',
  'students.search': 'Recherche de logements',
  'students.booking': 'Système de réservation',
  'students.verified': 'Annonces vérifiées',
  'students.documents': 'Gestion des documents',
  'students.messaging': 'Messagerie sécurisée',
  'students.reviews': 'Avis et évaluations',
  'students.favorites': 'Favoris',
  'students.profile': 'Gestion du profil',
  'students.access': 'Guide d\'accès',
  'students.community': 'Communauté',
  'students.free': 'Plateforme gratuite',
};

export default function FeatureCarouselManager() {
  const [features, setFeatures] = useState<FeatureImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [imageDropZone, setImageDropZone] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'landlords' | 'students'>('landlords');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFeatureKey, setNewFeatureKey] = useState('');

  useEffect(() => {
    loadFeatures();
  }, [selectedCategory]);

  async function loadFeatures() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('feature_carousel_images')
        .select('*')
        .like('feature_key', `${selectedCategory}.%`)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setFeatures(data || []);
    } catch (err) {
      console.error('Error loading features:', err);
      setError('Erreur lors du chargement des fonctionnalités');
    } finally {
      setLoading(false);
    }
  }

  async function updateFeature(id: string, updates: Partial<FeatureImage>) {
    try {
      setSaving(id);
      const { error } = await supabase
        .from('feature_carousel_images')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      await loadFeatures();
    } catch (err) {
      console.error('Error updating feature:', err);
      alert('Erreur lors de la mise à jour');
    } finally {
      setSaving(null);
    }
  }

  async function toggleActive(feature: FeatureImage) {
    await updateFeature(feature.id, { is_active: !feature.is_active });
  }

  async function deleteFeature(feature: FeatureImage) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer définitivement "${featureLabels[feature.feature_key]}" ?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('feature_carousel_images')
        .delete()
        .eq('id', feature.id);

      if (error) throw error;

      setFeatures(features.filter(f => f.id !== feature.id));
    } catch (err) {
      console.error('Error deleting feature:', err);
      alert('Erreur lors de la suppression');
    }
  }

  async function handleAddFeature() {
    if (!newFeatureKey.trim()) {
      setError('Veuillez entrer une clé pour la fonctionnalité');
      return;
    }

    if (!newFeatureKey.startsWith('landlords.') && !newFeatureKey.startsWith('students.')) {
      setError('La clé doit commencer par "landlords." ou "students."');
      return;
    }

    const category = newFeatureKey.split('.')[0];
    if ((selectedCategory === 'landlords' && category !== 'landlords') ||
        (selectedCategory === 'students' && category !== 'students')) {
      setError(`La clé doit commencer par "${selectedCategory}."`);
      return;
    }

    try {
      setError(null);
      const maxOrder = features.length > 0 ? Math.max(...features.map(f => f.display_order)) : 0;

      const { data, error } = await supabase
        .from('feature_carousel_images')
        .insert([{
          feature_key: newFeatureKey,
          image_url: 'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg',
          display_order: maxOrder + 1,
          is_active: true,
          title_fr: '',
          title_en: '',
          description_fr: '',
          description_en: ''
        }])
        .select()
        .single();

      if (error) throw error;

      setShowAddModal(false);
      setNewFeatureKey('');
      await loadFeatures();
    } catch (err: any) {
      console.error('Error adding feature:', err);
      if (err.code === '23505') {
        setError('Cette clé existe déjà');
      } else if (err.message?.includes('permission') || err.message?.includes('policy')) {
        setError('Vous devez être administrateur pour ajouter une fonctionnalité');
      } else {
        setError(`Erreur lors de l'ajout: ${err.message}`);
      }
    }
  }

  function handleDragStart(index: number) {
    setDraggedIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleDragLeave() {
    setDragOverIndex(null);
  }

  async function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newFeatures = [...features];
    const draggedItem = newFeatures[draggedIndex];

    newFeatures.splice(draggedIndex, 1);
    newFeatures.splice(dropIndex, 0, draggedItem);

    const updatedFeatures = newFeatures.map((feature, index) => ({
      ...feature,
      display_order: index + 1
    }));

    setFeatures(updatedFeatures);
    setDraggedIndex(null);
    setDragOverIndex(null);

    try {
      for (const feature of updatedFeatures) {
        await supabase
          .from('feature_carousel_images')
          .update({ display_order: feature.display_order })
          .eq('id', feature.id);
      }
    } catch (err) {
      console.error('Error updating order:', err);
      alert('Erreur lors de la mise à jour de l\'ordre');
      await loadFeatures();
    }
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  async function handleImageUpload(featureId: string, file: File) {
    try {
      setUploadingImage(featureId);

      const fileExt = file.name.split('.').pop();
      const fileName = `carousel-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      await updateFeature(featureId, { image_url: publicUrl });

      const updatedFeatures = features.map(f =>
        f.id === featureId ? { ...f, image_url: publicUrl } : f
      );
      setFeatures(updatedFeatures);

    } catch (err) {
      console.error('Error uploading image:', err);
      alert('Erreur lors de l\'upload de l\'image');
    } finally {
      setUploadingImage(null);
      setImageDropZone(null);
    }
  }

  function handleImageDragOver(e: React.DragEvent, featureId: string) {
    e.preventDefault();
    e.stopPropagation();
    setImageDropZone(featureId);
  }

  function handleImageDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setImageDropZone(null);
  }

  function handleImageDrop(e: React.DragEvent, featureId: string) {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        handleImageUpload(featureId, file);
      } else {
        alert('Veuillez déposer un fichier image (JPG, PNG, etc.)');
        setImageDropZone(null);
      }
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>, featureId: string) {
    const files = e.target.files;
    if (files && files[0]) {
      handleImageUpload(featureId, files[0]);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Image className="w-6 h-6 text-rose-600" />
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">Gestion du Carousel des Fonctionnalités</h2>
            <p className="text-sm text-gray-600 mt-1">
              Modifiez les images affichées dans le carousel de la page d'accueil
            </p>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-gray-200 items-center">
          <button
            onClick={() => setSelectedCategory('landlords')}
            className={`px-6 py-3 font-medium transition-all relative ${
              selectedCategory === 'landlords'
                ? 'text-rose-600 border-b-2 border-rose-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Propriétaires
          </button>
          <button
            onClick={() => setSelectedCategory('students')}
            className={`px-6 py-3 font-medium transition-all relative ${
              selectedCategory === 'students'
                ? 'text-rose-600 border-b-2 border-rose-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Étudiants
          </button>
          <div className="flex-1"></div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>

        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Ajouter une nouvelle fonctionnalité
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Clé de la fonctionnalité
                </label>
                <input
                  type="text"
                  value={newFeatureKey}
                  onChange={(e) => setNewFeatureKey(e.target.value)}
                  placeholder={`${selectedCategory}.nouvelle_fonction`}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddFeature();
                    }
                  }}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Exemple: {selectedCategory}.nouvelle_fonction
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewFeatureKey('');
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddFeature}
                  className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
                >
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        )}


        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">Erreur</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {features.map((feature, index) => (
            <div
              key={feature.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`p-5 rounded-lg border-2 transition-all cursor-move ${
                draggedIndex === index
                  ? 'opacity-50 scale-95'
                  : dragOverIndex === index
                  ? 'border-rose-500 bg-rose-50 scale-105 shadow-lg'
                  : feature.is_active
                  ? 'bg-white border-gray-200 hover:border-rose-300'
                  : 'bg-gray-50 border-gray-200 opacity-60'
              }`}
            >
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex items-center justify-center lg:justify-start">
                  <GripVertical className="w-6 h-6 text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0" />
                </div>
                <div
                  className="lg:w-48 h-32 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative group"
                  onDragOver={(e) => handleImageDragOver(e, feature.id)}
                  onDragLeave={handleImageDragLeave}
                  onDrop={(e) => handleImageDrop(e, feature.id)}
                >
                  <img
                    src={feature.image_url}
                    alt={featureLabels[feature.feature_key]}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage%3C/text%3E%3C/svg%3E';
                    }}
                  />

                  {uploadingImage === feature.id && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                      <div className="text-center text-white">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                        <p className="text-xs font-medium">Upload...</p>
                      </div>
                    </div>
                  )}

                  {imageDropZone === feature.id && uploadingImage !== feature.id && (
                    <div className="absolute inset-0 bg-rose-500 bg-opacity-90 flex items-center justify-center border-4 border-rose-600 border-dashed">
                      <div className="text-center text-white">
                        <Upload className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-xs font-bold">Déposez l'image</p>
                      </div>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                    <label
                      htmlFor={`upload-${feature.id}`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <div className="bg-white rounded-full p-3 hover:bg-gray-100 transition-colors">
                        <Upload className="w-5 h-5 text-gray-700" />
                      </div>
                      <input
                        id={`upload-${feature.id}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileInputChange(e, feature.id)}
                        disabled={uploadingImage === feature.id}
                      />
                    </label>
                  </div>
                </div>

                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">
                        {featureLabels[feature.feature_key] || feature.feature_key}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Position: {feature.display_order}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleActive(feature)}
                        disabled={saving === feature.id}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                          feature.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        {feature.is_active ? (
                          <>
                            <Eye className="w-4 h-4" />
                            Active
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-4 h-4" />
                            Inactive
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => deleteFeature(feature)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                        title="Supprimer définitivement"
                      >
                        <Trash2 className="w-4 h-4" />
                        Supprimer
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Titre (Français)
                      </label>
                      <input
                        type="text"
                        value={feature.title_fr || ''}
                        onChange={(e) => {
                          const newFeatures = features.map(f =>
                            f.id === feature.id ? { ...f, title_fr: e.target.value } : f
                          );
                          setFeatures(newFeatures);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                        placeholder="Ex: Baux et contrats"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Titre (Anglais)
                      </label>
                      <input
                        type="text"
                        value={feature.title_en || ''}
                        onChange={(e) => {
                          const newFeatures = features.map(f =>
                            f.id === feature.id ? { ...f, title_en: e.target.value } : f
                          );
                          setFeatures(newFeatures);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                        placeholder="Ex: Leases and contracts"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description (Français)
                      </label>
                      <textarea
                        value={feature.description_fr || ''}
                        onChange={(e) => {
                          const newFeatures = features.map(f =>
                            f.id === feature.id ? { ...f, description_fr: e.target.value } : f
                          );
                          setFeatures(newFeatures);
                        }}
                        rows={2}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
                        placeholder="Description de la fonctionnalité..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description (Anglais)
                      </label>
                      <textarea
                        value={feature.description_en || ''}
                        onChange={(e) => {
                          const newFeatures = features.map(f =>
                            f.id === feature.id ? { ...f, description_en: e.target.value } : f
                          );
                          setFeatures(newFeatures);
                        }}
                        rows={2}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
                        placeholder="Feature description..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        URL de l'image
                      </label>
                      <input
                        type="text"
                        value={feature.image_url}
                        onChange={(e) => {
                          const newFeatures = features.map(f =>
                            f.id === feature.id ? { ...f, image_url: e.target.value } : f
                          );
                          setFeatures(newFeatures);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                        placeholder="https://example.com/image.jpg ou /local-image.png"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Utilisez une URL Pexels ou un chemin local (ex: /6.png)
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Ordre d'affichage
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={feature.display_order}
                          onChange={(e) => {
                            const newOrder = parseInt(e.target.value);
                            if (!isNaN(newOrder)) {
                              const newFeatures = features.map(f =>
                                f.id === feature.id ? { ...f, display_order: newOrder } : f
                              );
                              setFeatures(newFeatures);
                            }
                          }}
                          className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                        />
                      </div>

                      <button
                        onClick={() => updateFeature(feature.id, {
                          title_fr: feature.title_fr,
                          title_en: feature.title_en,
                          description_fr: feature.description_fr,
                          description_en: feature.description_en,
                          image_url: feature.image_url,
                          display_order: feature.display_order
                        })}
                        disabled={saving === feature.id}
                        className="flex items-center gap-2 px-6 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                      >
                        {saving === feature.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Enregistrer
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {features.length === 0 && (
          <div className="text-center py-12">
            <Image className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Aucune fonctionnalité trouvée</p>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 mb-2">Conseils d'utilisation</h3>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>• <strong>Ajouter une nouvelle fonctionnalité</strong> : Cliquez sur "Ajouter" et entrez une clé unique</li>
              <li>• <strong>Personnaliser les textes</strong> : Modifiez les titres et descriptions en français et anglais</li>
              <li>• <strong>Glissez-déposez</strong> les cartes pour réorganiser l'ordre d'affichage dans le carousel</li>
              <li>• <strong>Survolez une image</strong> et cliquez sur l'icône d'upload, ou glissez-déposez une image directement</li>
              <li>• Les images uploadées sont automatiquement hébergées sur Supabase Storage</li>
              <li>• Format recommandé : JPEG ou PNG, ratio 16:9, résolution minimale 800x450px, max 5MB</li>
              <li>• Les modifications sont appliquées immédiatement sur la page d'accueil</li>
              <li>• <strong>Désactivez</strong> une fonctionnalité pour la masquer temporairement sans la supprimer</li>
              <li>• <strong>Supprimez</strong> une fonctionnalité pour la retirer définitivement de la base de données</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
