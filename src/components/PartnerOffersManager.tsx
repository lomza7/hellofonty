import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, Save, X, BadgeCheck, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PartnerOffer {
  id: string;
  title: string;
  description: string;
  company_name: string;
  image_url: string | null;
  cta_text: string;
  cta_link: string;
  is_active: boolean;
  display_order: number;
  verified: boolean;
  target_audience: 'landlord' | 'student' | 'both';
  created_at: string;
}

export default function PartnerOffersManager() {
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    company_name: '',
    image_url: '',
    cta_text: 'En savoir plus',
    cta_link: '',
    is_active: true,
    verified: true,
    target_audience: 'both' as 'landlord' | 'student' | 'both'
  });

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    try {
      const { data, error } = await supabase
        .from('partner_offers')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setOffers(data || []);
    } catch (error) {
      console.error('Error fetching offers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        const { error } = await supabase
          .from('partner_offers')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const maxOrder = offers.length > 0 ? Math.max(...offers.map(o => o.display_order)) : 0;
        const { error } = await supabase
          .from('partner_offers')
          .insert({ ...formData, display_order: maxOrder + 1 });

        if (error) throw error;
      }

      resetForm();
      fetchOffers();
    } catch (error) {
      console.error('Error saving offer:', error);
      alert('Erreur lors de l\'enregistrement de l\'offre');
    }
  };

  const handleEdit = (offer: PartnerOffer) => {
    setEditingId(offer.id);
    setFormData({
      title: offer.title,
      description: offer.description,
      company_name: offer.company_name,
      image_url: offer.image_url || '',
      cta_text: offer.cta_text,
      cta_link: offer.cta_link,
      is_active: offer.is_active,
      verified: offer.verified,
      target_audience: offer.target_audience
    });
    setIsCreating(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette offre ?')) return;

    try {
      const { error } = await supabase
        .from('partner_offers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchOffers();
    } catch (error) {
      console.error('Error deleting offer:', error);
      alert('Erreur lors de la suppression de l\'offre');
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('partner_offers')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      fetchOffers();
    } catch (error) {
      console.error('Error toggling offer status:', error);
    }
  };

  const moveOrder = async (id: string, direction: 'up' | 'down') => {
    const currentIndex = offers.findIndex(o => o.id === id);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === offers.length - 1)
    ) {
      return;
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const currentOffer = offers[currentIndex];
    const targetOffer = offers[targetIndex];

    try {
      await Promise.all([
        supabase
          .from('partner_offers')
          .update({ display_order: targetOffer.display_order })
          .eq('id', currentOffer.id),
        supabase
          .from('partner_offers')
          .update({ display_order: currentOffer.display_order })
          .eq('id', targetOffer.id)
      ]);

      fetchOffers();
    } catch (error) {
      console.error('Error reordering offers:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      company_name: '',
      image_url: '',
      cta_text: 'En savoir plus',
      cta_link: '',
      is_active: true,
      verified: true,
      target_audience: 'both'
    });
    setEditingId(null);
    setIsCreating(false);
  };

  if (loading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion des offres partenaires</h2>
          <p className="text-sm text-gray-600 mt-1">
            Gérez les offres affichées dans le carrousel des dashboards
          </p>
        </div>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="h-5 w-5" />
            Nouvelle offre
          </button>
        )}
      </div>

      {isCreating && (
        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-rose-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">
              {editingId ? 'Modifier l\'offre' : 'Nouvelle offre'}
            </h3>
            <button
              onClick={resetForm}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titre de l'offre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du partenaire *
                </label>
                <input
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                required
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Texte du bouton *
                </label>
                <input
                  type="text"
                  required
                  value={formData.cta_text}
                  onChange={(e) => setFormData({ ...formData, cta_text: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lien du bouton *
                </label>
                <input
                  type="url"
                  required
                  value={formData.cta_link}
                  onChange={(e) => setFormData({ ...formData, cta_link: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL de l'image
              </label>
              <input
                type="url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                placeholder="https://..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Public cible
                </label>
                <select
                  value={formData.target_audience}
                  onChange={(e) => setFormData({ ...formData, target_audience: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                >
                  <option value="both">Propriétaires & Étudiants</option>
                  <option value="landlord">Propriétaires uniquement</option>
                  <option value="student">Étudiants uniquement</option>
                </select>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-rose-500 rounded focus:ring-rose-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.verified}
                    onChange={(e) => setFormData({ ...formData, verified: e.target.checked })}
                    className="w-4 h-4 text-rose-500 rounded focus:ring-rose-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Vérifiée</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-medium transition-colors"
              >
                <Save className="h-4 w-4" />
                {editingId ? 'Mettre à jour' : 'Créer l\'offre'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {offers.map((offer, index) => (
          <div
            key={offer.id}
            className={`bg-white rounded-xl shadow-md p-6 border-2 ${
              offer.is_active ? 'border-green-200' : 'border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-gray-900">{offer.title}</h3>
                  {offer.verified && <BadgeCheck className="h-5 w-5 text-blue-500" />}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    offer.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {offer.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    {offer.target_audience === 'both' ? 'Tous' :
                     offer.target_audience === 'landlord' ? 'Propriétaires' : 'Étudiants'}
                  </span>
                </div>
                <p className="text-sm font-medium text-rose-600 mb-2">{offer.company_name}</p>
                <p className="text-sm text-gray-600 mb-3">{offer.description}</p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Bouton: {offer.cta_text}</span>
                  <span>•</span>
                  <span>Lien: {offer.cta_link}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex gap-1">
                  <button
                    onClick={() => moveOrder(offer.id, 'up')}
                    disabled={index === 0}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Monter"
                  >
                    <ArrowUp className="h-4 w-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => moveOrder(offer.id, 'down')}
                    disabled={index === offers.length - 1}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Descendre"
                  >
                    <ArrowDown className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
                <button
                  onClick={() => toggleActive(offer.id, offer.is_active)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title={offer.is_active ? 'Désactiver' : 'Activer'}
                >
                  {offer.is_active ? (
                    <EyeOff className="h-4 w-4 text-gray-600" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-600" />
                  )}
                </button>
                <button
                  onClick={() => handleEdit(offer)}
                  className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Modifier"
                >
                  <Edit2 className="h-4 w-4 text-blue-600" />
                </button>
                <button
                  onClick={() => handleDelete(offer.id)}
                  className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                  title="Supprimer"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {offers.length === 0 && !isCreating && (
          <div className="text-center py-12 bg-gray-50 rounded-xl">
            <p className="text-gray-500">Aucune offre partenaire pour le moment</p>
          </div>
        )}
      </div>
    </div>
  );
}
