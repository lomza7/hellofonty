import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import EmailVerification from '../components/EmailVerification';
import { supabase } from '../lib/supabase';

type AuthProps = {
  mode: 'signin' | 'signup';
  onNavigate: (page: string) => void;
};

export default function Auth({ mode, onNavigate }: AuthProps) {
  const { signIn, signUp } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<'student' | 'landlord'>('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingRole, setPendingRole] = useState<'student' | 'landlord'>('student');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) throw error;
        onNavigate('home');
      } else {
        const { error } = await signUp(email, password, {
          first_name: firstName,
          last_name: lastName,
          role,
        });

        if (error) throw error;

        setPendingEmail(email);
        setPendingRole(role);
        setShowEmailVerification(true);
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue / An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailVerified = () => {
    setSuccess('Email vérifié ! Vous pouvez maintenant vous connecter. / Email verified! You can now sign in.');
    setShowEmailVerification(false);
    setTimeout(() => {
      onNavigate('signin');
    }, 2000);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setResetLoading(true);

    try {
      const checkEmailUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-email-exists`;
      const checkResponse = await fetch(checkEmailUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email: resetEmail.toLowerCase().trim() }),
      });

      const { exists } = await checkResponse.json();

      if (!exists) {
        setError(`🕵️ ${t('auth.emailNotFound')} 😊`);
        setResetLoading(false);
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.toLowerCase().trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setSuccess(`✅ ${t('auth.resetEmailSent')} 📧`);
      setResetEmail('');
      setTimeout(() => {
        setShowForgotPassword(false);
        setSuccess('');
      }, 8000);
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setResetLoading(false);
    }
  };

  if (showEmailVerification) {
    return <EmailVerification email={pendingEmail} onVerified={handleEmailVerified} />;
  }

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-blue-50 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-lg border border-gray-100">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-2">
              {t('auth.forgotPasswordTitle')} 🔑
            </h2>
            <p className="text-gray-600">
              {t('auth.forgotPasswordSubtitle')}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleForgotPassword} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Email
              </label>
              <input
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="exemple@email.com"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition bg-gray-50 focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={resetLoading}
              className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold rounded-xl hover:from-rose-600 hover:to-pink-700 transition-all transform hover:scale-[1.02] disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-rose-200"
            >
              {resetLoading ? `📤 ${t('auth.sending')}` : `📧 ${t('auth.sendResetLink')}`}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => {
                setShowForgotPassword(false);
                setError('');
                setSuccess('');
              }}
              className="text-gray-600 hover:text-gray-900 text-sm font-medium transition"
            >
              ← {t('auth.backToSignIn')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-blue-50 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-lg border border-gray-100">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-gray-900 mb-2">
            {mode === 'signin' ? t('auth.signIn') : t('auth.signUp')}
          </h2>
          <p className="text-gray-600">
            {mode === 'signin'
              ? 'Bienvenue ! Connectez-vous à votre compte'
              : 'Créez votre compte en quelques secondes'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'signup' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    {t('auth.firstName')}
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jean"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition bg-gray-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    {t('auth.lastName')}
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Dupont"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition bg-gray-50 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  {t('auth.role')}
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setRole('student')}
                    className={`px-6 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 ${
                      role === 'student'
                        ? 'bg-rose-500 text-white shadow-lg shadow-rose-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {t('auth.student')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('landlord')}
                    className={`px-6 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 ${
                      role === 'landlord'
                        ? 'bg-gray-900 text-white shadow-lg shadow-gray-300'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {t('auth.landlord')}
                  </button>
                </div>
              </div>

            </>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              {t('auth.email')}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemple@email.com"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition bg-gray-50 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              {t('auth.password')}
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition bg-gray-50 focus:bg-white"
              minLength={6}
            />
            {mode === 'signup' && (
              <p className="text-xs text-gray-500 mt-1">Minimum 6 caractères</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold rounded-xl hover:from-rose-600 hover:to-pink-700 transition-all transform hover:scale-[1.02] disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-rose-200 mt-6"
          >
            {loading
              ? t('common.loading')
              : mode === 'signin'
              ? t('auth.signInButton')
              : t('auth.signUpButton')}
          </button>
        </form>

        {mode === 'signin' && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setShowForgotPassword(true)}
              className="text-gray-600 hover:text-rose-600 text-sm font-medium transition"
            >
              {t('auth.forgotPassword')}
            </button>
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => onNavigate(mode === 'signin' ? 'signup' : 'signin')}
            className="text-gray-600 hover:text-gray-900 text-sm font-medium transition"
          >
            {mode === 'signin' ? t('auth.noAccount') : t('auth.alreadyAccount')}
          </button>
        </div>
      </div>
    </div>
  );
}
