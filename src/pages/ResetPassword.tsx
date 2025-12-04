import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';

type ResetPasswordProps = {
  onNavigate: (page: string) => void;
};

export default function ResetPassword({ onNavigate }: ResetPasswordProps) {
  const { t } = useLanguage();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError(`🔒 ${t('auth.invalidResetLink')}`);
      }
    };
    checkSession();
  }, [t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 6) {
      setError(`⚠️ ${t('auth.passwordTooShort')}`);
      return;
    }

    if (password !== confirmPassword) {
      setError(`❌ ${t('auth.passwordsNotMatch')}`);
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setSuccess(`✅ ${t('auth.passwordUpdated')}`);
      setTimeout(() => {
        onNavigate('signin');
      }, 2000);
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-blue-50 flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-lg border border-gray-100">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-gray-900 mb-2">
            {t('auth.resetPasswordTitle')}
          </h2>
          <p className="text-gray-600">
            {t('auth.resetPasswordSubtitle')}
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
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              {t('auth.newPassword')}
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
            <p className="text-xs text-gray-500 mt-1">{t('auth.minCharacters')}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              {t('auth.confirmPassword')}
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition bg-gray-50 focus:bg-white"
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold rounded-xl hover:from-rose-600 hover:to-pink-700 transition-all transform hover:scale-[1.02] disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-rose-200 mt-6"
          >
            {loading ? t('auth.updating') : t('auth.changePassword')}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => onNavigate('signin')}
            className="text-gray-600 hover:text-gray-900 text-sm font-medium transition"
          >
            ← {t('auth.backToSignIn')}
          </button>
        </div>
      </div>
    </div>
  );
}
