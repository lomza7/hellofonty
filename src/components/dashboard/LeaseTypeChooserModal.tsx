import { useState } from 'react';
import { X, FileText, Upload, Eye, CheckCircle2, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface LeaseTypeChooserModalProps {
  taskId: string;
  onClose: () => void;
  onComplete: () => void;
}

export default function LeaseTypeChooserModal({ taskId, onClose, onComplete }: LeaseTypeChooserModalProps) {
  const { profile, updateProfile, refreshProfile } = useAuth();
  const [selectedType, setSelectedType] = useState<'hellofonty' | 'custom' | null>(
    (profile?.preferred_lease_type as 'hellofonty' | 'custom') || null
  );
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handlePreview = async () => {
    setLoadingPreview(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non authentifié');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-lease-preview`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur lors de la génération de l\'aperçu');
      }

      const html = await response.text();
      setPreviewHtml(html);
      setShowPreview(true);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedType || !profile) return;

    setSaving(true);
    setError('');
    try {
      const { error: updateError } = await updateProfile({ preferred_lease_type: selectedType });
      if (updateError) throw updateError;

      await refreshProfile();

      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (taskError) throw taskError;

      onComplete();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setSaving(false);
    }
  };

  if (showPreview && previewHtml) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full h-[85vh] flex flex-col relative">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <button
              onClick={() => setShowPreview(false)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium transition"
            >
              <ArrowLeft className="w-5 h-5" />
              Retour au choix
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <iframe
              srcDoc={previewHtml}
              className="w-full h-full border-0"
              title="Aperçu du bail HelloFonty"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Choisir le type de bail
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Sélectionnez le type de bail que vous souhaitez utiliser pour vos locations. Vous pourrez consulter le modèle HelloFonty avant de décider.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div className="mb-6">
          <button
            onClick={handlePreview}
            disabled={loadingPreview}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-xl transition border border-blue-200 disabled:opacity-50"
          >
            {loadingPreview ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
            {loadingPreview ? 'Génération de l\'aperçu...' : 'Voir le modèle HelloFonty'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => setSelectedType('hellofonty')}
            className={`text-left p-5 rounded-xl border-2 transition-all ${
              selectedType === 'hellofonty'
                ? 'border-rose-500 bg-rose-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-rose-300'
            }`}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                selectedType === 'hellofonty' ? 'bg-rose-500' : 'bg-gray-100'
              }`}>
                <FileText className={`w-5 h-5 ${selectedType === 'hellofonty' ? 'text-white' : 'text-gray-500'}`} />
              </div>
              {selectedType === 'hellofonty' && (
                <CheckCircle2 className="w-5 h-5 text-rose-500 ml-auto" />
              )}
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Modèle HelloFonty</h3>
            <p className="text-sm text-gray-600">
              Contrat type généré automatiquement, conforme à la loi. Rempli avec les informations de votre réservation.
            </p>
          </button>

          <button
            onClick={() => setSelectedType('custom')}
            className={`text-left p-5 rounded-xl border-2 transition-all ${
              selectedType === 'custom'
                ? 'border-rose-500 bg-rose-50 shadow-md'
                : 'border-gray-200 bg-white hover:border-rose-300'
            }`}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                selectedType === 'custom' ? 'bg-rose-500' : 'bg-gray-100'
              }`}>
                <Upload className={`w-5 h-5 ${selectedType === 'custom' ? 'text-white' : 'text-gray-500'}`} />
              </div>
              {selectedType === 'custom' && (
                <CheckCircle2 className="w-5 h-5 text-rose-500 ml-auto" />
              )}
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Mon propre bail</h3>
            <p className="text-sm text-gray-600">
              Téléversez votre propre document (PDF ou Word). Les informations de la réservation seront pré-remplies.
            </p>
          </button>
        </div>

        {selectedType === 'custom' && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm text-amber-800">
              <strong>Formats acceptés :</strong> PDF et Word uniquement. Taille maximum : 20 Mo.
              Votre bail sera pré-rempli automatiquement avec les informations de la réservation (locataire, dates, loyer, charges, caution).
            </p>
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={!selectedType || saving}
          className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold rounded-xl hover:from-rose-600 hover:to-pink-700 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Confirmer mon choix
            </>
          )}
        </button>
      </div>
    </div>
  );
}
