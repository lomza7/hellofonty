import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Image, Upload, Save, Trash2, Eye, EyeOff, AlertCircle, GripVertical } from 'lucide-react';

interface FeatureImage {
  id: string;
  feature_key: string;
  image_url: string;
  display_order: number;
  is_active: boolean;
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
};

export default function FeatureCarouselManager() {
  const [features, setFeatures] = useState<FeatureImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    loadFeatures();
  }, []);

  async function loadFeatures() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('feature_carousel_images')
        .select('*')
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
          <div>
            <h2 className="text-xl font-bold text-gray-900">Gestion du Carousel des Fonctionnalités</h2>
            <p className="text-sm text-gray-600 mt-1">
              Modifiez les images affichées dans le carousel de la page d'accueil
            </p>
          </div>
        </div>

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
                <div className="lg:w-48 h-32 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={feature.image_url}
                    alt={featureLabels[feature.feature_key]}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage%3C/text%3E%3C/svg%3E';
                    }}
                  />
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
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      URL de l'image
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={feature.image_url}
                        onChange={(e) => {
                          const newFeatures = features.map(f =>
                            f.id === feature.id ? { ...f, image_url: e.target.value } : f
                          );
                          setFeatures(newFeatures);
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                        placeholder="https://example.com/image.jpg ou /local-image.png"
                      />
                      <button
                        onClick={() => updateFeature(feature.id, { image_url: feature.image_url })}
                        disabled={saving === feature.id}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <p className="text-xs text-gray-500">
                      Utilisez une URL Pexels ou un chemin local (ex: /6.png)
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <div className="flex-1">
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
                            updateFeature(feature.id, { display_order: newOrder });
                          }
                        }}
                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                      />
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
              <li>• <strong>Glissez-déposez</strong> les cartes pour réorganiser l'ordre d'affichage dans le carousel</li>
              <li>• Les images doivent être hébergées en ligne (Pexels) ou placées dans le dossier /public</li>
              <li>• Format recommandé : JPEG ou PNG, ratio 16:9, résolution minimale 800x450px</li>
              <li>• Les modifications sont appliquées immédiatement sur la page d'accueil</li>
              <li>• Désactivez une fonctionnalité pour la masquer temporairement sans supprimer l'image</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
