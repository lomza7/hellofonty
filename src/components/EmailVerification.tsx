import { useState } from 'react';
import { Mail, Check, AlertCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

type EmailVerificationProps = {
  email: string;
  onVerified: () => void;
};

export default function EmailVerification({ email, onVerified }: EmailVerificationProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  const sendVerificationCode = async () => {
    setError('');
    setSuccess('');
    setSending(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-verification-email`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Échec de l\'envoi du code');
      }

      setCodeSent(true);
      setSuccess('Code de vérification envoyé ! Vérifiez votre email. / Verification code sent! Check your email.');
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue / An error occurred');
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-email-code`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Code invalide');
      }

      setSuccess('Email vérifié avec succès ! / Email verified successfully!');
      setTimeout(() => {
        onVerified();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Code de vérification invalide / Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-blue-50 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-md border border-gray-100">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-rose-100 rounded-full mb-4">
            <Mail className="w-8 h-8 text-rose-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Vérification de l'email
          </h2>
          <p className="text-gray-600">
            Vérifiez votre adresse email pour continuer
          </p>
          <p className="text-sm text-gray-500 mt-2 font-semibold">
            {email}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-start gap-2">
            <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {!codeSent ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              Cliquez sur le bouton ci-dessous pour recevoir un code de vérification par email.
            </p>
            <button
              onClick={sendVerificationCode}
              disabled={sending}
              className="w-full bg-rose-500 text-white py-4 rounded-xl font-semibold hover:bg-rose-600 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-rose-200"
            >
              {sending ? 'Envoi en cours...' : 'Envoyer le code'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Code de vérification
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition bg-gray-50 focus:bg-white text-center text-2xl font-mono tracking-widest"
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                Entrez le code à 6 chiffres reçu par email
              </p>
            </div>

            <button
              onClick={verifyCode}
              disabled={loading || code.length !== 6}
              className="w-full bg-rose-500 text-white py-4 rounded-xl font-semibold hover:bg-rose-600 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-rose-200"
            >
              {loading ? 'Vérification...' : 'Vérifier le code'}
            </button>

            <button
              onClick={sendVerificationCode}
              disabled={sending}
              className="w-full text-rose-600 py-2 text-sm font-semibold hover:text-rose-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Renvoyer le code
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
