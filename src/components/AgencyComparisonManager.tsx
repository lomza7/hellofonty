import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, MoveUp, MoveDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';

interface ComparisonFeature {
  id: string;
  feature_fr: string;
  feature_en: string;
  hellofonty_has: boolean;
  hellofonty_details_fr: string | null;
  hellofonty_details_en: string | null;
  agency_has: boolean;
  agency_details_fr: string | null;
  agency_details_en: string | null;
  order_index: number;
  is_active: boolean;
}

export default function AgencyComparisonManager() {
  const { language } = useLanguage();
  const [features, setFeatures] = useState<ComparisonFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Partial<ComparisonFeature>>({
    feature_fr: '',
    feature_en: '',
    hellofonty_has: true,
    hellofonty_details_fr: null,
    hellofonty_details_en: null,
    agency_has: false,
    agency_details_fr: null,
    agency_details_en: null,
    order_index: 0,
    is_active: true,
  });

  const isFrench = language === 'fr';

  useEffect(() => {
    loadFeatures();
  }, []);

  async function loadFeatures() {
    try {
      const { data, error } = await supabase
        .from('agency_comparison_features')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) throw error;
      setFeatures(data || []);
    } catch (error) {
      console.error('Error loading features:', error);
      alert('Erreur lors du chargement des critères');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      if (editingId) {
        const { error } = await supabase
          .from('agency_comparison_features')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('agency_comparison_features')
          .insert([formData]);

        if (error) throw error;
      }

      await loadFeatures();
      resetForm();
      alert(editingId ? 'Critère modifié avec succès' : 'Critère ajouté avec succès');
    } catch (error) {
      console.error('Error saving feature:', error);
      alert('Erreur lors de la sauvegarde');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Voulez-vous vraiment supprimer ce critère ?')) return;

    try {
      const { error } = await supabase
        .from('agency_comparison_features')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await loadFeatures();
      alert('Critère supprimé avec succès');
    } catch (error) {
      console.error('Error deleting feature:', error);
      alert('Erreur lors de la suppression');
    }
  }

  async function handleMove(id: string, direction: 'up' | 'down') {
    const index = features.findIndex(f => f.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === features.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const feature = features[index];
    const otherFeature = features[newIndex];

    try {
      await Promise.all([
        supabase
          .from('agency_comparison_features')
          .update({ order_index: otherFeature.order_index })
          .eq('id', feature.id),
        supabase
          .from('agency_comparison_features')
          .update({ order_index: feature.order_index })
          .eq('id', otherFeature.id)
      ]);

      await loadFeatures();
    } catch (error) {
      console.error('Error moving feature:', error);
      alert('Erreur lors du déplacement');
    }
  }

  function startEdit(feature: ComparisonFeature) {
    setEditingId(feature.id);
    setFormData(feature);
    setShowAddForm(true);
  }

  function resetForm() {
    setEditingId(null);
    setShowAddForm(false);
    setFormData({
      feature_fr: '',
      feature_en: '',
      hellofonty_has: true,
      hellofonty_details_fr: null,
      hellofonty_details_en: null,
      agency_has: false,
      agency_details_fr: null,
      agency_details_en: null,
      order_index: features.length,
      is_active: true,
    });
  }

  if (loading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-900">
          {isFrench ? 'Comparaison avec Agences' : 'Agency Comparison'}
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition"
        >
          <Plus className="h-5 w-5" />
          {isFrench ? 'Ajouter un critère' : 'Add Criterion'}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-gray-50 rounded-lg p-6 space-y-4">
          <h4 className="font-semibold text-gray-900">
            {editingId ? (isFrench ? 'Modifier le critère' : 'Edit Criterion') : (isFrench ? 'Nouveau critère' : 'New Criterion')}
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isFrench ? 'Critère (Français)' : 'Criterion (French)'}
              </label>
              <input
                type="text"
                value={formData.feature_fr || ''}
                onChange={(e) => setFormData({ ...formData, feature_fr: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isFrench ? 'Critère (Anglais)' : 'Criterion (English)'}
              </label>
              <input
                type="text"
                value={formData.feature_en || ''}
                onChange={(e) => setFormData({ ...formData, feature_en: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <h5 className="font-medium text-gray-900">Hellofonty</h5>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.hellofonty_has || false}
                  onChange={(e) => setFormData({ ...formData, hellofonty_has: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-sm text-gray-700">
                  {isFrench ? 'Hellofonty offre ce service' : 'Hellofonty offers this service'}
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isFrench ? 'Détails (Français)' : 'Details (French)'}
                </label>
                <input
                  type="text"
                  value={formData.hellofonty_details_fr || ''}
                  onChange={(e) => setFormData({ ...formData, hellofonty_details_fr: e.target.value || null })}
                  placeholder="Ex: 0€ - 99€/an"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isFrench ? 'Détails (Anglais)' : 'Details (English)'}
                </label>
                <input
                  type="text"
                  value={formData.hellofonty_details_en || ''}
                  onChange={(e) => setFormData({ ...formData, hellofonty_details_en: e.target.value || null })}
                  placeholder="Ex: 0€ - 99€/year"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-3">
              <h5 className="font-medium text-gray-900">
                {isFrench ? 'Agences Immobilières' : 'Real Estate Agencies'}
              </h5>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.agency_has || false}
                  onChange={(e) => setFormData({ ...formData, agency_has: e.target.checked })}
                  className="w-4 h-4"
                />
                <label className="text-sm text-gray-700">
                  {isFrench ? 'Les agences offrent ce service' : 'Agencies offer this service'}
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isFrench ? 'Détails (Français)' : 'Details (French)'}
                </label>
                <input
                  type="text"
                  value={formData.agency_details_fr || ''}
                  onChange={(e) => setFormData({ ...formData, agency_details_fr: e.target.value || null })}
                  placeholder="Ex: 800€ - 1500€"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isFrench ? 'Détails (Anglais)' : 'Details (English)'}
                </label>
                <input
                  type="text"
                  value={formData.agency_details_en || ''}
                  onChange={(e) => setFormData({ ...formData, agency_details_en: e.target.value || null })}
                  placeholder="Ex: 800€ - 1500€"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.is_active || false}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4"
            />
            <label className="text-sm text-gray-700">
              {isFrench ? 'Actif' : 'Active'}
            </label>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <Save className="h-5 w-5" />
              {isFrench ? 'Sauvegarder' : 'Save'}
            </button>
            <button
              onClick={resetForm}
              className="flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
            >
              <X className="h-5 w-5" />
              {isFrench ? 'Annuler' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                {isFrench ? 'Critère' : 'Criterion'}
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Hellofonty
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                {isFrench ? 'Agences' : 'Agencies'}
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                {isFrench ? 'Statut' : 'Status'}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {features.map((feature, index) => (
              <tr key={feature.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">
                    {isFrench ? feature.feature_fr : feature.feature_en}
                  </div>
                  {(feature.hellofonty_details_fr || feature.agency_details_fr) && (
                    <div className="text-xs text-gray-500 mt-1">
                      Hellofonty: {isFrench ? feature.hellofonty_details_fr : feature.hellofonty_details_en} •
                      {isFrench ? ' Agences' : ' Agencies'}: {isFrench ? feature.agency_details_fr : feature.agency_details_en}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`inline-block w-2 h-2 rounded-full ${feature.hellofonty_has ? 'bg-green-500' : 'bg-red-500'}`} />
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`inline-block w-2 h-2 rounded-full ${feature.agency_has ? 'bg-green-500' : 'bg-red-500'}`} />
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    feature.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {feature.is_active ? (isFrench ? 'Actif' : 'Active') : (isFrench ? 'Inactif' : 'Inactive')}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleMove(feature.id, 'up')}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <MoveUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleMove(feature.id, 'down')}
                      disabled={index === features.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <MoveDown className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => startEdit(feature)}
                      className="p-1 text-blue-600 hover:text-blue-800"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(feature.id)}
                      className="p-1 text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
