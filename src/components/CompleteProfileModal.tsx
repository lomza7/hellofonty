import { useState } from 'react';
import { Phone, Mail, AlertCircle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Props = {
  userId: string;
  userEmail: string;
  currentPhone: string | null;
  onComplete: () => void;
};

export default function CompleteProfileModal({ userId, userEmail, currentPhone, onComplete }: Props) {
  const [phone, setPhone] = useState(currentPhone || '');
  const [email, setEmail] = useState(userEmail || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isPhoneValid = phone.trim().length >= 8;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = isPhoneValid && isEmailValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError('');

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ phone: phone.trim() })
      .eq('id', userId);

    if (updateError) {
      setError('Une erreur est survenue. Veuillez réessayer.');
      setSaving(false);
      return;
    }

    if (email.trim() !== userEmail) {
      const { error: emailError } = await supabase.auth.updateUser({ email: email.trim() });
      if (emailError) {
        setError('Impossible de mettre à jour l\'email. Veuillez réessayer.');
        setSaving(false);
        return;
      }
    }

    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Complétez votre profil</h2>
              <p className="text-emerald-100 text-sm">Informations requises pour continuer</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <p className="text-gray-600 text-sm leading-relaxed">
            Pour assurer une communication fluide entre propriétaires et locataires, 
            nous avons besoin de votre numéro de téléphone et de votre email de contact.
          </p>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <X className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email de contact
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                placeholder="votre@email.com"
                required
              />
            </div>
            {email && !isEmailValid && (
              <p className="mt-1 text-xs text-red-500">Veuillez entrer un email valide</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Numéro de téléphone
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                placeholder="+33 6 12 34 56 78"
                required
              />
            </div>
            {phone && !isPhoneValid && (
              <p className="mt-1 text-xs text-red-500">Veuillez entrer un numéro valide (min. 8 chiffres)</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit || saving}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors duration-200 flex items-center justify-center gap-2"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Enregistrer et continuer'
            )}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Ces informations sont visibles uniquement par l'administration de la plateforme.
          </p>
        </form>
      </div>
    </div>
  );
}
