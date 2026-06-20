import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, Plus, CreditCard as Edit2, Trash2, Save, X, Check, RefreshCw, Loader2, AlertCircle, CheckCircle, GraduationCap } from 'lucide-react';

interface PricingPlan {
  id: string;
  name: string;
  type: 'landlord' | 'student';
  plan_category: string;
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
  plan_category: string;
  price: string;
  billing_period: 'monthly' | 'yearly' | 'one_time';
  stripe_price_id: string;
  stripe_product_id: string;
  features: string;
  is_active: boolean;
}

interface StripePrice {
  price_id: string;
  amount: number;
  currency: string;
  interval: string | null;
}

interface StudentFeeConfig {
  amount: string;
  stripe_price_id: string;
  stripe_product_id: string;
  features_fr: string[];
  features_en: string[];
}

export default function PricingPlansManager() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [availablePrices, setAvailablePrices] = useState<StripePrice[]>([]);
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

  const [studentFee, setStudentFee] = useState<StudentFeeConfig>({
    amount: '390',
    stripe_price_id: '',
    stripe_product_id: '',
    features_fr: [],
    features_en: [],
  });
  const [studentFeeLoading, setStudentFeeLoading] = useState(true);
  const [studentFeeSaving, setStudentFeeSaving] = useState(false);
  const [studentFeeError, setStudentFeeError] = useState('');
  const [studentFeeSuccess, setStudentFeeSuccess] = useState('');
  const [studentFeeSyncing, setStudentFeeSyncing] = useState(false);
  const [studentFeeSyncMessage, setStudentFeeSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [studentFeeAvailablePrices, setStudentFeeAvailablePrices] = useState<StripePrice[]>([]);
  const [editingStudentFeatures, setEditingStudentFeatures] = useState('');

  useEffect(() => {
    loadPlans();
    loadStudentFee();
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

  async function loadStudentFee() {
    try {
      setStudentFeeLoading(true);
      const { data, error } = await supabase
        .from('platform_settings')
        .select('setting_key, setting_value')
        .in('setting_key', [
          'platform_fee_amount',
          'student_fee_stripe_price_id',
          'student_fee_stripe_product_id',
          'student_fee_features_fr',
          'student_fee_features_en',
        ]);

      if (error) throw error;

      const getValue = (key: string) => data?.find(s => s.setting_key === key)?.setting_value || '';

      const featuresFr = getValue('student_fee_features_fr');
      const featuresEn = getValue('student_fee_features_en');

      let parsedFr: string[] = [];
      let parsedEn: string[] = [];
      try { parsedFr = featuresFr ? JSON.parse(featuresFr) : []; } catch { parsedFr = []; }
      try { parsedEn = featuresEn ? JSON.parse(featuresEn) : []; } catch { parsedEn = []; }

      const config: StudentFeeConfig = {
        amount: getValue('platform_fee_amount') || '390',
        stripe_price_id: getValue('student_fee_stripe_price_id'),
        stripe_product_id: getValue('student_fee_stripe_product_id'),
        features_fr: parsedFr,
        features_en: parsedEn,
      };

      setStudentFee(config);
      setEditingStudentFeatures(parsedFr.join('\n'));
    } catch (err: any) {
      console.error('Erreur chargement frais etudiants:', err);
      setStudentFeeError(err.message);
    } finally {
      setStudentFeeLoading(false);
    }
  }

  async function saveStudentFee() {
    try {
      setStudentFeeSaving(true);
      setStudentFeeError('');
      setStudentFeeSuccess('');

      const feeAmount = parseFloat(studentFee.amount);
      if (isNaN(feeAmount) || feeAmount < 0) {
        throw new Error('Le montant des frais doit etre un nombre positif');
      }

      const featuresFr = editingStudentFeatures
        .split('\n')
        .map(f => f.trim())
        .filter(f => f.length > 0);

      let featuresEn: string[] = featuresFr;
      try {
        const translated = await translateToEnglish(featuresFr);
        if (Array.isArray(translated)) featuresEn = translated;
      } catch { /* keep FR as fallback */ }

      const updates = [
        { key: 'platform_fee_amount', value: studentFee.amount },
        { key: 'student_fee_stripe_price_id', value: studentFee.stripe_price_id },
        { key: 'student_fee_stripe_product_id', value: studentFee.stripe_product_id },
        { key: 'student_fee_features_fr', value: JSON.stringify(featuresFr) },
        { key: 'student_fee_features_en', value: JSON.stringify(featuresEn) },
      ];

      for (const { key, value } of updates) {
        const { error } = await supabase
          .from('platform_settings')
          .update({ setting_value: value })
          .eq('setting_key', key);
        if (error) throw error;
      }

      setStudentFee(prev => ({
        ...prev,
        features_fr: featuresFr,
        features_en: featuresEn,
      }));

      setStudentFeeSuccess('Frais de reservation etudiants sauvegardes');
      setTimeout(() => setStudentFeeSuccess(''), 3000);
    } catch (err: any) {
      console.error('Erreur sauvegarde:', err);
      setStudentFeeError(err.message);
    } finally {
      setStudentFeeSaving(false);
    }
  }

  async function fetchStudentFeeStripeInfo() {
    if (studentFeeSyncing) return;

    const { stripe_price_id, stripe_product_id } = studentFee;
    if (!stripe_price_id && !stripe_product_id) {
      setStudentFeeSyncMessage({ type: 'error', text: 'Entrez un ID Produit ou ID Prix Stripe pour synchroniser.' });
      return;
    }

    try {
      setStudentFeeSyncing(true);
      setStudentFeeSyncMessage(null);
      setStudentFeeAvailablePrices([]);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStudentFeeSyncMessage({ type: 'error', text: 'Session expiree. Reconnectez-vous.' });
        return;
      }

      const body: Record<string, string> = {};
      if (stripe_price_id) {
        body.price_id = stripe_price_id;
      } else if (stripe_product_id) {
        body.product_id = stripe_product_id;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-get-price`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur Stripe');
      }

      const data = await response.json();

      if (stripe_price_id) {
        setStudentFee(prev => ({
          ...prev,
          amount: data.amount.toString(),
          stripe_product_id: data.product_id || prev.stripe_product_id,
        }));

        setStudentFeeSyncMessage({
          type: 'success',
          text: `Synchronise : ${data.product_name} - ${data.amount} EUR`,
        });
      } else {
        if (data.prices && data.prices.length > 0) {
          setStudentFeeAvailablePrices(data.prices);

          const firstPrice = data.prices[0];
          setStudentFee(prev => ({
            ...prev,
            amount: firstPrice.amount.toString(),
            stripe_price_id: firstPrice.price_id,
          }));

          setStudentFeeSyncMessage({
            type: 'success',
            text: `${data.product_name} - ${data.prices.length} prix disponible(s). Selectionnez ci-dessous.`,
          });
        } else {
          setStudentFeeSyncMessage({ type: 'error', text: 'Aucun prix actif pour ce produit Stripe.' });
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erreur inconnue';
      setStudentFeeSyncMessage({ type: 'error', text: `Erreur : ${msg}` });
    } finally {
      setStudentFeeSyncing(false);
    }
  }

  function selectStudentFeeStripePrice(price: StripePrice) {
    setStudentFee(prev => ({
      ...prev,
      amount: price.amount.toString(),
      stripe_price_id: price.price_id,
    }));
  }

  function startEdit(plan: PricingPlan) {
    setEditingId(plan.id);
    setSyncMessage(null);
    setAvailablePrices([]);
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
    setSyncMessage(null);
    setAvailablePrices([]);
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
    setSyncMessage(null);
    setAvailablePrices([]);
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

  async function fetchStripeInfo() {
    if (syncing) return;

    const { stripe_price_id, stripe_product_id } = editingData;
    if (!stripe_price_id && !stripe_product_id) {
      setSyncMessage({ type: 'error', text: 'Entrez un ID Produit ou ID Prix Stripe pour synchroniser.' });
      return;
    }

    try {
      setSyncing(true);
      setSyncMessage(null);
      setAvailablePrices([]);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSyncMessage({ type: 'error', text: 'Session expiree. Reconnectez-vous.' });
        return;
      }

      const body: Record<string, string> = {};
      if (stripe_price_id) {
        body.price_id = stripe_price_id;
      } else if (stripe_product_id) {
        body.product_id = stripe_product_id;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-get-price`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur Stripe');
      }

      const data = await response.json();

      if (stripe_price_id) {
        const interval = data.interval;
        let billing: 'monthly' | 'yearly' | 'one_time' = 'one_time';
        if (interval === 'month') billing = 'monthly';
        else if (interval === 'year') billing = 'yearly';

        setEditingData(prev => ({
          ...prev,
          price: data.amount.toString(),
          stripe_product_id: data.product_id || prev.stripe_product_id,
          billing_period: billing,
        }));

        setSyncMessage({
          type: 'success',
          text: `Synchronise : ${data.product_name} - ${data.amount}EUR/${interval || 'unique'}`,
        });
      } else {
        if (data.prices && data.prices.length > 0) {
          setAvailablePrices(data.prices);

          const firstPrice = data.prices[0];
          const interval = firstPrice.interval;
          let billing: 'monthly' | 'yearly' | 'one_time' = 'one_time';
          if (interval === 'month') billing = 'monthly';
          else if (interval === 'year') billing = 'yearly';

          setEditingData(prev => ({
            ...prev,
            price: firstPrice.amount.toString(),
            stripe_price_id: firstPrice.price_id,
            billing_period: billing,
          }));

          setSyncMessage({
            type: 'success',
            text: `${data.product_name} - ${data.prices.length} prix disponible(s). Selectionnez ci-dessous.`,
          });
        } else {
          setSyncMessage({ type: 'error', text: 'Aucun prix actif pour ce produit Stripe.' });
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erreur inconnue';
      setSyncMessage({ type: 'error', text: `Erreur : ${msg}` });
    } finally {
      setSyncing(false);
    }
  }

  function selectStripePrice(price: StripePrice) {
    const interval = price.interval;
    let billing: 'monthly' | 'yearly' | 'one_time' = 'one_time';
    if (interval === 'month') billing = 'monthly';
    else if (interval === 'year') billing = 'yearly';

    setEditingData(prev => ({
      ...prev,
      price: price.amount.toString(),
      stripe_price_id: price.price_id,
      billing_period: billing,
    }));
  }

  async function translateToEnglish(text: string | string[]): Promise<string | string[]> {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ text, from: 'fr', to: 'en' }),
        }
      );

      if (!response.ok) throw new Error('Translation failed');

      const data = await response.json();
      return Array.isArray(text) ? data.translations : data.translation;
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    }
  }

  async function savePlan() {
    if (saving) return;

    try {
      setSaving(true);

      const featuresArray = editingData.features
        .split('\n')
        .map(f => f.trim())
        .filter(f => f.length > 0);

      const nameEn = await translateToEnglish(editingData.name) as string;
      const featuresEn = await translateToEnglish(featuresArray) as string[];

      const planData = {
        name: editingData.name,
        name_en: nameEn,
        type: editingData.type,
        plan_category: editingData.plan_category,
        price: parseFloat(editingData.price),
        billing_period: editingData.billing_period,
        stripe_price_id: editingData.stripe_price_id || null,
        stripe_product_id: editingData.stripe_product_id || null,
        features: featuresArray,
        features_en: featuresEn,
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
    } finally {
      setSaving(false);
    }
  }

  async function deletePlan(id: string) {
    if (!confirm('Etes-vous sur de vouloir supprimer ce plan ?')) return;

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

      {renderStudentFeeSection()}

      {isCreating && (
        <div className="bg-blue-50 border-2 border-blue-500 rounded-xl p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Creer un nouveau plan</h3>
          {renderEditForm()}
        </div>
      )}

      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-rose-600" />
          Plans Proprietaires
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          {landlordPlans.map(plan => renderPlan(plan))}
        </div>
      </div>
    </div>
  );

  function renderStudentFeeSection() {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-5 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-rose-600" />
            Frais de reservation etudiants
          </h3>
          <p className="text-gray-500 text-sm mt-1">
            Montant unique facture aux etudiants lors de chaque reservation. Ce montant est utilise dans les paiements Stripe, la page tarifs et les analytics.
          </p>
        </div>

        <div className="p-5 space-y-4">
          {studentFeeError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{studentFeeError}</p>
            </div>
          )}

          {studentFeeSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-green-700 text-sm">{studentFeeSuccess}</p>
            </div>
          )}

          {studentFeeLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-rose-600"></div>
            </div>
          ) : (
            <>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-semibold text-gray-800">Configuration Stripe</h5>
                  <button
                    type="button"
                    onClick={fetchStudentFeeStripeInfo}
                    disabled={studentFeeSyncing}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {studentFeeSyncing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    {studentFeeSyncing ? 'Synchronisation...' : 'Synchroniser depuis Stripe'}
                  </button>
                </div>

                {studentFeeSyncMessage && (
                  <div className={`text-sm px-3 py-2 rounded-lg ${
                    studentFeeSyncMessage.type === 'success'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {studentFeeSyncMessage.text}
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ID Produit Stripe
                    </label>
                    <input
                      type="text"
                      value={studentFee.stripe_product_id}
                      onChange={e => setStudentFee(prev => ({ ...prev, stripe_product_id: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                      placeholder="prod_xxxxx"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ID Prix Stripe
                    </label>
                    <input
                      type="text"
                      value={studentFee.stripe_price_id}
                      onChange={e => setStudentFee(prev => ({ ...prev, stripe_price_id: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                      placeholder="price_xxxxx"
                    />
                  </div>
                </div>

                {studentFeeAvailablePrices.length > 1 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Prix disponibles pour ce produit :
                    </label>
                    <div className="space-y-2">
                      {studentFeeAvailablePrices.map((p) => (
                        <button
                          key={p.price_id}
                          type="button"
                          onClick={() => selectStudentFeeStripePrice(p)}
                          className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                            studentFee.stripe_price_id === p.price_id
                              ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                              : 'border-gray-200 bg-white hover:border-blue-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-gray-900">{p.amount}EUR</span>
                              <span className="text-gray-500 text-sm ml-1">
                                {p.interval === 'month' ? '/mois' : p.interval === 'year' ? '/an' : 'unique'}
                              </span>
                            </div>
                            <span className="text-xs text-gray-400 font-mono">{p.price_id}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col md:flex-row gap-5">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Montant des frais de reservation
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={studentFee.amount}
                      onChange={(e) => setStudentFee(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent text-lg font-semibold bg-gray-50"
                      readOnly={!!studentFee.stripe_price_id}
                    />
                    <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">
                      EUR
                    </span>
                  </div>
                  {studentFee.stripe_price_id && (
                    <p className="text-xs text-gray-400 mt-1">Rempli automatiquement depuis Stripe</p>
                  )}
                </div>

                <div className="flex-1 bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-sm text-gray-600 font-medium mb-3">Apercu de la repartition (ex: 850 EUR)</p>
                  {(() => {
                    const total = 850;
                    const fee = parseFloat(studentFee.amount || '390');
                    const landlordAmount = total - fee;
                    return (
                      <div className="text-sm text-gray-700 space-y-1.5">
                        <div className="flex justify-between">
                          <span>Montant total</span>
                          <span className="font-semibold">{total.toFixed(2)} EUR</span>
                        </div>
                        <div className="flex justify-between text-rose-700">
                          <span>Frais reservation</span>
                          <span className="font-bold">{fee.toFixed(2)} EUR</span>
                        </div>
                        <div className="flex justify-between text-green-700 pt-1.5 border-t border-gray-200">
                          <span>Proprietaire</span>
                          <span className="font-bold">{landlordAmount.toFixed(2)} EUR</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Avantages affiches sur la page tarifs (une par ligne)
                </label>
                <textarea
                  value={editingStudentFeatures}
                  onChange={e => setEditingStudentFeatures(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  placeholder={"Frais de mise en relation\nAssurance reservation\nSupport 24/7\nPaiement securise"}
                />
                <p className="text-xs text-gray-400 mt-1">Traduit automatiquement en anglais lors de la sauvegarde</p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={saveStudentFee}
                  disabled={studentFeeSaving || studentFeeLoading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white font-semibold rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {studentFeeSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Traduction et sauvegarde...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Sauvegarder
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

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
              <span className="text-3xl font-bold text-rose-600">{plan.price}EUR</span>
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
              Prix (EUR)
            </label>
            <input
              type="number"
              step="0.01"
              value={editingData.price}
              onChange={e => setEditingData({ ...editingData, price: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-gray-50"
              readOnly
            />
            <p className="text-xs text-gray-400 mt-1">Rempli automatiquement depuis Stripe</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Periode de facturation
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

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-sm font-semibold text-gray-800">Configuration Stripe</h5>
            <button
              type="button"
              onClick={fetchStripeInfo}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {syncing ? 'Synchronisation...' : 'Synchroniser depuis Stripe'}
            </button>
          </div>

          {syncMessage && (
            <div className={`text-sm px-3 py-2 rounded-lg ${
              syncMessage.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {syncMessage.text}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID Produit Stripe
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
                ID Prix Stripe
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

          {availablePrices.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prix disponibles pour ce produit :
              </label>
              <div className="space-y-2">
                {availablePrices.map((p) => (
                  <button
                    key={p.price_id}
                    type="button"
                    onClick={() => selectStripePrice(p)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                      editingData.stripe_price_id === p.price_id
                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                        : 'border-gray-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-gray-900">{p.amount}EUR</span>
                        <span className="text-gray-500 text-sm ml-1">
                          {p.interval === 'month' ? '/mois' : p.interval === 'year' ? '/an' : 'unique'}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 font-mono">{p.price_id}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fonctionnalites (une par ligne)
          </label>
          <textarea
            value={editingData.features}
            onChange={e => setEditingData({ ...editingData, features: e.target.value })}
            rows={5}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            placeholder={"Annonces illimitees\nCalendrier de disponibilite\nSupport prioritaire"}
          />
        </div>

        <div className="flex items-center gap-3 pt-4">
          <button
            onClick={savePlan}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Traduction et enregistrement...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Enregistrer
              </>
            )}
          </button>
          <button
            onClick={cancelEdit}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
            Annuler
          </button>
        </div>
      </div>
    );
  }
}
