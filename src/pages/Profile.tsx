import { useState, useEffect, useRef } from 'react';
import { Upload, Camera, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import VerificationStatusCard from '../components/VerificationStatusCard';

export default function Profile() {
  const { t } = useLanguage();
  const { profile, updateProfile, refreshProfile } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+33');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState<'fr' | 'en'>('fr');
  const [verificationFile, setVerificationFile] = useState<File | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const countries = [
    { code: '+33', flag: '🇫🇷', name: 'France' },
    { code: '+1', flag: '🇺🇸', name: 'USA' },
    { code: '+44', flag: '🇬🇧', name: 'UK' },
    { code: '+49', flag: '🇩🇪', name: 'Allemagne' },
    { code: '+34', flag: '🇪🇸', name: 'Espagne' },
    { code: '+39', flag: '🇮🇹', name: 'Italie' },
    { code: '+32', flag: '🇧🇪', name: 'Belgique' },
    { code: '+41', flag: '🇨🇭', name: 'Suisse' },
    { code: '+351', flag: '🇵🇹', name: 'Portugal' },
  ];

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name);
      setLastName(profile.last_name);

      if (profile.phone) {
        const matchedCountry = countries.find(c => profile.phone?.startsWith(c.code));
        if (matchedCountry) {
          setCountryCode(matchedCountry.code);
          setPhone(profile.phone.substring(matchedCountry.code.length));
        } else {
          setPhone(profile.phone);
        }
      }

      setPreferredLanguage(profile.preferred_language);

      if (profile.avatar_url) {
        setAvatarPreview(profile.avatar_url);
      }
    }
  }, [profile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setVerificationFile(file);
      setError('');
    } else {
      setError('Veuillez sélectionner un fichier PDF / Please select a PDF file');
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        if (file.size <= 5 * 1024 * 1024) {
          setAvatarFile(file);
          const reader = new FileReader();
          reader.onloadend = () => {
            setAvatarPreview(reader.result as string);
          };
          reader.readAsDataURL(file);
          setError('');
        } else {
          setError('La photo doit faire moins de 5 MB / Photo must be less than 5 MB');
        }
      } else {
        setError('Veuillez sélectionner une image / Please select an image file');
      }
    }
  };

  const uploadVerificationDocument = async (file: File) => {
    if (!profile) return null;

    const fileExt = 'pdf';
    const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
    const filePath = `verification-documents/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from('documents').getPublicUrl(filePath);

    return publicUrl;
  };

  const uploadAvatar = async (file: File) => {
    if (!profile) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${profile.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('profile-avatars')
      .upload(fileName, file, { upsert: true });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from('profile-avatars').getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const updates: any = {
        first_name: firstName,
        last_name: lastName,
        phone: phone ? `${countryCode}${phone}` : null,
        preferred_language: preferredLanguage,
      };

      if (avatarFile) {
        const avatarUrl = await uploadAvatar(avatarFile);
        updates.avatar_url = avatarUrl;
      }

      if (verificationFile) {
        const documentUrl = await uploadVerificationDocument(verificationFile);
        updates.verification_document_url = documentUrl;
        updates.verification_status = 'pending';
        updates.verification_submitted_at = new Date().toISOString();
      }

      const { error: updateError } = await updateProfile(updates);
      if (updateError) throw updateError;

      await refreshProfile();

      setSuccess(t('common.success'));
      setVerificationFile(null);
      setAvatarFile(null);
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-blue-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl shadow-2xl p-10 border border-gray-100">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">{t('profile.title')}</h1>

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
              {success}
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-10">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-rose-100 to-blue-100 border-4 border-white shadow-xl">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-10 h-10 bg-rose-500 rounded-full flex items-center justify-center shadow-lg hover:bg-rose-600 transition-all transform hover:scale-110"
                >
                  <Camera className="w-5 h-5 text-white" />
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {t('profile.personalInfo')}
              </h2>

              <div className="space-y-5">
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
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition bg-gray-50 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    {t('auth.phone')}
                  </label>
                  <div className="relative flex">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                        className="h-full px-4 py-3 border border-gray-200 rounded-l-xl bg-gray-50 hover:bg-gray-100 transition flex items-center space-x-2 focus:ring-2 focus:ring-rose-400 focus:z-10"
                      >
                        <span className="text-xl">{countries.find(c => c.code === countryCode)?.flag}</span>
                        <span className="text-sm font-semibold text-gray-700">{countryCode}</span>
                        <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {showCountryDropdown && (
                        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                          {countries.map((country) => (
                            <button
                              key={country.code}
                              type="button"
                              onClick={() => {
                                setCountryCode(country.code);
                                setShowCountryDropdown(false);
                              }}
                              className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-rose-50 transition text-left"
                            >
                              <span className="text-2xl">{country.flag}</span>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-900">{country.name}</p>
                                <p className="text-xs text-gray-500">{country.code}</p>
                              </div>
                              {countryCode === country.code && (
                                <svg className="h-5 w-5 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="6 12 34 56 78"
                      className="flex-1 px-4 py-3 border border-l-0 border-gray-200 rounded-r-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition bg-gray-50 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-3">
                    {t('profile.language')}
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setPreferredLanguage('fr')}
                      className={`px-6 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 ${
                        preferredLanguage === 'fr'
                          ? 'bg-rose-500 text-white shadow-lg shadow-rose-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Français
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreferredLanguage('en')}
                      className={`px-6 py-4 rounded-xl font-semibold transition-all transform hover:scale-105 ${
                        preferredLanguage === 'en'
                          ? 'bg-rose-500 text-white shadow-lg shadow-rose-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      English
                    </button>
                  </div>
                </div>

                <div className="p-5 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-600 mb-1">{t('auth.role')}</p>
                      <p className="text-xl font-bold text-gray-900">
                        {profile.role === 'student' ? t('auth.student') : t('auth.landlord')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {profile.role === 'student' && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Vérification INSEAD
                </h2>

                <div className="space-y-6">
                  <VerificationStatusCard
                    status={profile.verification_status || 'not_submitted'}
                    submittedAt={profile.verification_submitted_at}
                    reviewedAt={profile.verification_reviewed_at}
                    rejectionReason={profile.verification_rejection_reason}
                    language={preferredLanguage}
                    hasAvatar={!!profile.avatar_url || !!avatarPreview}
                    hasDocument={!!profile.verification_document_url || !!verificationFile}
                  />

                  <div className="bg-gray-50 rounded-2xl p-6 border-2 border-gray-100">
                    <label className="block text-base font-bold text-gray-900 mb-4">
                      {profile.verification_document_url || verificationFile
                        ? (preferredLanguage === 'fr' ? 'Remplacer le document' : 'Replace document')
                        : (preferredLanguage === 'fr' ? 'Attestation de scolarité INSEAD (PDF)' : 'INSEAD school certificate (PDF)')}
                      {!profile.verification_document_url && !verificationFile && (
                        <span className="text-rose-600 ml-1">*</span>
                      )}
                    </label>
                    {!verificationFile && !profile.verification_document_url && (
                      <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-rose-400 bg-white transition cursor-pointer">
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={handleFileChange}
                          className="hidden"
                          id="verification-upload"
                          required={!profile.verification_document_url}
                        />
                        <label
                          htmlFor="verification-upload"
                          className="cursor-pointer flex flex-col items-center"
                        >
                          <Upload className="h-12 w-12 text-gray-400 mb-3" />
                          <span className="text-sm font-semibold text-gray-700 mb-1">
                            {preferredLanguage === 'fr'
                              ? 'Télécharger votre attestation de scolarité'
                              : 'Upload your school certificate'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {preferredLanguage === 'fr'
                              ? 'Format PDF uniquement • Max 10 MB'
                              : 'PDF format only • Max 10 MB'}
                          </span>
                        </label>
                      </div>
                    )}
                    {(verificationFile || profile.verification_document_url) && (
                      <div className="bg-white border-2 border-green-300 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="bg-green-100 p-2 rounded-lg">
                            <svg className="h-6 w-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {verificationFile ? verificationFile.name : (profile.verification_document_url ? (preferredLanguage === 'fr' ? 'Document téléchargé' : 'Document uploaded') : '')}
                            </p>
                            {verificationFile && (
                              <p className="text-xs text-gray-500">
                                {(verificationFile.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            )}
                          </div>
                        </div>
                        {verificationFile && (
                          <button
                            type="button"
                            onClick={() => setVerificationFile(null)}
                            className="text-rose-600 hover:text-rose-800 text-sm font-semibold px-3 py-1 hover:bg-rose-50 rounded-lg transition"
                          >
                            {preferredLanguage === 'fr' ? 'Retirer' : 'Remove'}
                          </button>
                        )}
                        {profile.verification_document_url && !verificationFile && profile.verification_status !== 'approved' && (
                          <label
                            htmlFor="verification-upload"
                            className="text-blue-600 hover:text-blue-800 text-sm font-semibold px-3 py-1 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          >
                            {preferredLanguage === 'fr' ? 'Remplacer' : 'Replace'}
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (profile.role === 'student' && !avatarPreview) || (profile.role === 'student' && profile.verification_status === 'not_submitted' && !verificationFile)}
              className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold rounded-xl hover:from-rose-600 hover:to-pink-700 transition-all transform hover:scale-[1.02] disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-rose-200"
            >
              {loading ? t('common.loading') : t('profile.save')}
            </button>
            {profile.role === 'student' && (!avatarPreview || (profile.verification_status === 'not_submitted' && !verificationFile)) && (
              <p className="text-sm text-rose-600 text-center -mt-2">
                {!avatarPreview
                  ? (preferredLanguage === 'fr' ? 'Une photo de profil est obligatoire' : 'Profile photo is required')
                  : (preferredLanguage === 'fr' ? 'Veuillez télécharger votre attestation de scolarité pour continuer' : 'Please upload your school certificate to continue')}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
