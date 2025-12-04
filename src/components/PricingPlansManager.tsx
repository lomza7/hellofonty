import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, Plus, Edit2, Trash2, Save, X, Check } from 'lucide-react';

interface PricingPlan {
  id: string;
  name: string;
  type: 'landlord' | 'student';
  plan_category: 'subscription' | 'booking_fee';
  price: number;
  currency: string;
  billing_period: 'monthly' | 'yearly' | 'one_time';
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  features: string[];
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface EditingPlan {
  name: string;
  type: 'landlord' | 'student';
  plan_category: 'subscription' | 'booking_fee';
  price: string;
  billing_period: 'monthly' | 'yearly' | 'one_time';
  stripe_price_id: string;
  stripe_product_id: string;
  features: string;
  is_active: boolean;
}

export default function PricingPlansManager() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingData, setEditingData] = useState<EditingPlan>({
    name: '',
    type: 'landlord',
    plan_category: 'subscription',
    price: '0',
    billing_period: 'monthly',
    stripe_price_id: '',
    stripe_product_id: '',
    features: '',
    is_active: true,
  });

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    try {
      const { data, error } = await supabase
        .from('pricing_plans')
        .select('*')
        .order('type', { ascending: true })
        .order('display_order', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(plan: PricingPlan) {
    setEditingId(plan.id);
    setEditingData({
      name: plan.name,
      type: plan.type,
      plan_category: plan.plan_category,
      price: plan.price.toString(),
      billing_period: plan.billing_period,
      stripe_price_id: plan.stripe_price_id || '',
      stripe_product_id: plan.stripe_product_id || '',
      features: plan.features.join('\n'),
      is_active: plan.is_active,
    });
  }

  function startCreate() {
    setIsCreating(true);
    setEditingData({
      name: '',
      type: 'landlord',
      plan_category: 'subscription',
      price: '0',
      billing_period: 'monthly',
      stripe_price_id: '',
      stripe_product_id: '',
      features: '',
      is_active: true,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setIsCreating(false);
    setEditingData({
      name: '',
      type: 'landlord',
      plan_category: 'subscription',
      price: '0',
      billing_period: 'monthly',
      stripe_price_id: '',
      stripe_product_id: '',
      features: '',
      is_active: true,
    });
  }

  async function savePlan() {
    try {
      const featuresArray = editingData.features
        .split('\n')
        .map(f => f.trim())
        .filter(f => f.length > 0);

      const planData = {
        name: editingData.name,
        type: editingData.type,
        plan_category: editingData.plan_category,
        price: parseFloat(editingData.price),
        billing_period: editingData.billing_period,
        stripe_price_id: editingData.stripe_price_id || null,
        stripe_product_id: editingData.stripe_product_id || null,
        features: featuresArray,
        is_active: editingData.is_active,
      };

      if (isCreating) {
        const { error } = await supabase
          .from('pricing_plans')
          .insert(planData);

        if (error) throw error;
      } else if (editingId) {
        const { error } = await supabase
          .from('pricing_plans')
          .update(planData)
          .eq('id', editingId);

        if (error) throw error;
      }

      await loadPlans();
      cancelEdit();
    } catch (error) {
      console.error('Error saving plan:', error);
      alert('Erreur lors de la sauvegarde du plan');
    }
  }

  async function deletePlan(id: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce plan ?')) return;

    try {
      const { error } = await supabase
        .from('pricing_plans')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadPlans();
    } catch (error) {
      console.error('Error deleting plan:', error);
      alert('Erreur lors de la suppression du plan');
    }
  }

  const landlordPlans = plans.filter(p => p.type === 'landlord');
  const studentPlans = plans.filter(p => p.type === 'student');

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion des Offres Tarifaires</h2>
          <p className="text-gray-600 mt-1">Configurez les plans d'abonnement et les frais pour votre plateforme</p>
        </div>
        <button
          onClick={startCreate}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nouveau Plan
        </button>
      </div>

      {isCreating && (
        <div className="bg-blue-50 border-2 border-blue-500 rounded-xl p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Créer un nouveau plan</h3>
          {renderEditForm()}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-rose-600" />
            Plans Propriétaires
          </h3>
          <div className="space-y-4">
            {landlordPlans.map(plan => renderPlan(plan))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-rose-600" />
            Plans Étudiants
          </h3>
          <div className="space-y-4">
            {studentPlans.map(plan => renderPlan(plan))}
          </div>
        </div>
      </div>
    </div>
  );

  function renderPlan(plan: PricingPlan) {
    const isEditing = editingId === plan.id;

    if (isEditing) {
      return (
        <div key={plan.id} className="bg-blue-50 border-2 border-blue-500 rounded-xl p-6">
          <h4 className="text-md font-bold text-gray-900 mb-4">Modifier le plan</h4>
          {renderEditForm()}
        </div>
      );
    }

    return (
      <div
        key={plan.id}
        className={`bg-white rounded-xl shadow-sm border-2 p-6 transition-all ${
          plan.is_active ? 'border-gray-200' : 'border-gray-300 opacity-60'
        }`}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="text-lg font-bold text-gray-900">{plan.name}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-3xl font-bold text-rose-600">{plan.price}€</span>
              <span className="text-gray-500 text-sm">
                {plan.billing_period === 'monthly' && '/mois'}
                {plan.billing_period === 'yearly' && '/an'}
                {plan.billing_period === 'one_time' && 'unique'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {plan.is_active ? (
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                Actif
              </span>
            ) : (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                Inactif
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {plan.features.map((feature, index) => (
            <div key={index} className="flex items-start gap-2 text-sm text-gray-700">
              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>{feature}</span>
            </div>
          ))}
        </div>

        {(plan.stripe_price_id || plan.stripe_product_id) && (
          <div className="pt-4 border-t border-gray-200 space-y-1">
            {plan.stripe_product_id && (
              <p className="text-xs text-gray-500">
                <span className="font-medium">Produit Stripe:</span> {plan.stripe_product_id}
              </p>
            )}
            {plan.stripe_price_id && (
              <p className="text-xs text-gray-500">
                <span className="font-medium">Prix Stripe:</span> {plan.stripe_price_id}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={() => startEdit(plan)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Modifier
          </button>
          <button
            onClick={() => deletePlan(plan.id)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  function renderEditForm() {
    return (
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom du plan
            </label>
            <input
              type="text"
              value={editingData.name}
              onChange={e => setEditingData({ ...editingData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              placeholder="Ex: Premium"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type d'utilisateur
            </label>
            <select
              value={editingData.type}
              onChange={e => setEditingData({ ...editingData, type: e.target.value as 'landlord' | 'student' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            >
              <option value="landlord">Propriétaire</option>
              <option value="student">Étudiant</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Catégorie
            </label>
            <select
              value={editingData.plan_category}
              onChange={e => setEditingData({ ...editingData, plan_category: e.target.value as 'subscription' | 'booking_fee' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            >
              <option value="subscription">Abonnement</option>
              <option value="booking_fee">Frais de réservation</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prix (€)
            </label>
            <input
              type="number"
              step="0.01"
              value={editingData.price}
              onChange={e => setEditingData({ ...editingData, price: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Période de facturation
            </label>
            <select
              value={editingData.billing_period}
              onChange={e => setEditingData({ ...editingData, billing_period: e.target.value as 'monthly' | 'yearly' | 'one_time' })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            >
              <option value="monthly">Mensuel</option>
              <option value="yearly">Annuel</option>
              <option value="one_time">Unique</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Statut
            </label>
            <div className="flex items-center h-full">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingData.is_active}
                  onChange={e => setEditingData({ ...editingData, is_active: e.target.checked })}
                  className="w-5 h-5 text-rose-600 border-gray-300 rounded focus:ring-rose-500"
                />
                <span className="ml-2 text-sm text-gray-700">Plan actif</span>
              </label>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID Produit Stripe (optionnel)
            </label>
            <input
              type="text"
              value={editingData.stripe_product_id}
              onChange={e => setEditingData({ ...editingData, stripe_product_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              placeholder="prod_xxxxx"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID Prix Stripe (optionnel)
            </label>
            <input
              type="text"
              value={editingData.stripe_price_id}
              onChange={e => setEditingData({ ...editingData, stripe_price_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              placeholder="price_xxxxx"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fonctionnalités (une par ligne)
          </label>
          <textarea
            value={editingData.features}
            onChange={e => setEditingData({ ...editingData, features: e.target.value })}
            rows={5}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            placeholder="Annonces illimitées&#10;Calendrier de disponibilité&#10;Support prioritaire"
          />
        </div>

        <div className="flex items-center gap-3 pt-4">
          <button
            onClick={savePlan}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
          >
            <Save className="w-5 h-5" />
            Enregistrer
          </button>
          <button
            onClick={cancelEdit}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
            Annuler
          </button>
        </div>
      </div>
    );
  }
}
