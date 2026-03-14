import { useState, useEffect, useRef } from 'react';
import { Upload, Camera, User, Mail, Phone, Globe, Shield, CheckCircle, AlertCircle, FileText, Save, CircleUser as UserCircle, Settings, Eye, Clock as ClockIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import BackButton from '../components/BackButton';

interface LandlordDocument {
  id: string;
  document_type: string;
  document_url: string;
  verification_status: string;
  submitted_at: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

export default function Profile() {
  const { t } = useLanguage();
  const { profile, updateProfile, refreshProfile, user } = useAuth();

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
  const [landlordDocuments, setLandlordDocuments] = useState<LandlordDocument[]>([]);
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

      if (profile.role === 'landlord') {
        loadLandlordDocuments();
      }
    }
  }, [profile]);

  const loadLandlordDocuments = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('landlord_documents')
        .select('*')
        .eq('landlord_id', profile.id)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      setLandlordDocuments(data || []);
    } catch (err) {
      console.error('Error loading landlord documents:', err);
    }
  };

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

        const storagePath = documentUrl?.split('/documents/')[1] || '';

        const existingDoc = await supabase
          .from('student_documents')
          .select('id')
          .eq('student_id', profile.id)
          .eq('document_type', 'insead_attestation')
          .maybeSingle();

        if (existingDoc.data) {
          await supabase
            .from('student_documents')
            .update({
              file_url: storagePath,
              file_name: verificationFile.name,
              status: 'pending',
              uploaded_at: new Date().toISOString(),
            })
            .eq('id', existingDoc.data.id);
        } else {
          await supabase.from('student_documents').insert({
            student_id: profile.id,
            document_type: 'insead_attestation',
            file_url: storagePath,
            file_name: verificationFile.name,
            status: 'pending',
          });
        }
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
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-rose-500 border-t-transparent"></div>
      </div>
    );
  }

  const getVerificationStatusConfig = () => {
    const status = profile.verification_status || 'not_submitted';
    switch (status) {
      case 'approved':
        return {
          icon: CheckCircle,
          color: 'green',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-800',
          iconColor: 'text-green-600',
          title: preferredLanguage === 'fr' ? 'Compte vérifié' : 'Account verified',
          description: preferredLanguage === 'fr'
            ? 'Votre compte est vérifié. Vous avez accès à toutes les fonctionnalités.'
            : 'Your account is verified. You have full access to all features.'
        };
      case 'pending':
        return {
          icon: AlertCircle,
          color: 'orange',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          textColor: 'text-orange-800',
          iconColor: 'text-orange-600',
          title: preferredLanguage === 'fr' ? 'Vérification en cours' : 'Verification in progress',
          description: preferredLanguage === 'fr'
            ? 'Votre demande est en cours de traitement. Nous vous contacterons bientôt.'
            : 'Your request is being processed. We will contact you soon.'
        };
      case 'rejected':
        return {
          icon: AlertCircle,
          color: 'red',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          iconColor: 'text-red-600',
          title: preferredLanguage === 'fr' ? 'Vérification refusée' : 'Verification rejected',
          description: profile.verification_rejection_reason || (preferredLanguage === 'fr'
            ? 'Veuillez soumettre de nouveaux documents.'
            : 'Please submit new documents.')
        };
      default:
        return {
          icon: Shield,
          color: 'gray',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-800',
          iconColor: 'text-gray-600',
          title: preferredLanguage === 'fr' ? 'Compte non vérifié' : 'Account not verified',
          description: preferredLanguage === 'fr'
            ? 'Complétez votre profil pour accéder à toutes les fonctionnalités.'
            : 'Complete your profile to access all features.'
        };
    }
  };

  const verificationStatus = getVerificationStatusConfig();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <BackButton />
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 px-8 py-12 relative overflow-hidden">
            <div className="absolute inset-0 bg-black/5"></div>
            <div className="relative flex items-center gap-6">
              <div className="relative group">
                <div className="w-28 h-28 rounded-2xl overflow-hidden bg-white shadow-2xl ring-4 ring-white/30">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-rose-100 to-pink-100">
                      <User className="w-14 h-14 text-rose-400" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-2 -right-2 w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all transform hover:scale-110 text-rose-600 hover:text-rose-700"
                >
                  <Camera className="w-5 h-5" />
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-2">
                  {firstName} {lastName}
                </h1>
                <div className="flex items-center gap-3">
                  <span className="px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-semibold text-white border border-white/30">
                    {profile.role === 'student' ? t('auth.student') : t('auth.landlord')}
                  </span>
                  <span className="px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium text-white border border-white/30 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {user?.email}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="p-8">
              {success && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium">{success}</span>
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                        <UserCircle className="w-5 h-5 text-rose-600" />
                      </div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {t('profile.personalInfo')}
                      </h2>
                    </div>

                    <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            {t('auth.firstName')}
                          </label>
                          <input
                            type="text"
                            required
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            {t('auth.lastName')}
                          </label>
                          <input
                            type="text"
                            required
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          {t('auth.phone')}
                        </label>
                        <div className="relative flex">
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                              className="h-full px-4 py-3 border border-gray-200 rounded-l-xl bg-white hover:bg-gray-50 transition flex items-center space-x-2 focus:ring-2 focus:ring-rose-400 focus:z-10"
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
                                      <CheckCircle className="h-5 w-5 text-rose-500" />
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
                            className="flex-1 px-4 py-3 border border-l-0 border-gray-200 rounded-r-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent transition bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Settings className="w-5 h-5 text-blue-600" />
                      </div>
                      <h2 className="text-xl font-bold text-gray-900">
                        Paramètres
                      </h2>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        {t('profile.language')}
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setPreferredLanguage('fr')}
                          className={`px-6 py-4 rounded-xl font-semibold transition-all ${
                            preferredLanguage === 'fr'
                              ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          🇫🇷 Français
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreferredLanguage('en')}
                          className={`px-6 py-4 rounded-xl font-semibold transition-all ${
                            preferredLanguage === 'en'
                              ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          🇬🇧 English
                        </button>
                      </div>
                    </div>
                  </div>

                  {profile.role === 'student' && (
                    <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                          <FileText className="w-5 h-5 text-purple-600" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">
                          Document de vérification INSEAD
                        </h2>
                      </div>

                      <div>
                        {!verificationFile && !profile.verification_document_url && (
                          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-rose-400 bg-white transition cursor-pointer group">
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
                              <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-rose-100 transition">
                                <Upload className="h-8 w-8 text-rose-500" />
                              </div>
                              <span className="text-base font-semibold text-gray-900 mb-2">
                                {preferredLanguage === 'fr'
                                  ? 'Télécharger votre attestation INSEAD'
                                  : 'Upload your INSEAD certificate'}
                              </span>
                              <span className="text-sm text-gray-500">
                                {preferredLanguage === 'fr'
                                  ? 'Format PDF uniquement • Max 10 MB'
                                  : 'PDF format only • Max 10 MB'}
                              </span>
                            </label>
                          </div>
                        )}
                        {(verificationFile || profile.verification_document_url) && (
                          <div className="bg-green-50 border-2 border-green-300 rounded-xl p-5 flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="bg-green-100 p-3 rounded-xl">
                                <FileText className="h-7 w-7 text-green-600" />
                              </div>
                              <div>
                                <p className="text-base font-semibold text-gray-900">
                                  {verificationFile ? verificationFile.name : (preferredLanguage === 'fr' ? 'Document téléchargé' : 'Document uploaded')}
                                </p>
                                {verificationFile && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    {(verificationFile.size / 1024 / 1024).toFixed(2)} MB
                                  </p>
                                )}
                              </div>
                            </div>
                            {verificationFile && (
                              <button
                                type="button"
                                onClick={() => setVerificationFile(null)}
                                className="text-rose-600 hover:text-rose-700 text-sm font-semibold px-4 py-2 hover:bg-white rounded-lg transition"
                              >
                                {preferredLanguage === 'fr' ? 'Retirer' : 'Remove'}
                              </button>
                            )}
                            {profile.verification_document_url && !verificationFile && profile.verification_status !== 'approved' && (
                              <label
                                htmlFor="verification-upload"
                                className="text-blue-600 hover:text-blue-700 text-sm font-semibold px-4 py-2 hover:bg-white rounded-lg transition cursor-pointer"
                              >
                                {preferredLanguage === 'fr' ? 'Remplacer' : 'Replace'}
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  {profile.role === 'student' && (
                    <div className={`${verificationStatus.bgColor} border-2 ${verificationStatus.borderColor} rounded-2xl p-6 shadow-sm`}>
                      <div className="flex items-start gap-4 mb-4">
                        <div className={`w-12 h-12 ${verificationStatus.bgColor} rounded-xl flex items-center justify-center flex-shrink-0 ring-2 ring-white`}>
                          <verificationStatus.icon className={`w-6 h-6 ${verificationStatus.iconColor}`} />
                        </div>
                        <div className="flex-1">
                          <h3 className={`text-lg font-bold ${verificationStatus.textColor} mb-1`}>
                            {verificationStatus.title}
                          </h3>
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {verificationStatus.description}
                          </p>
                        </div>
                      </div>

                      {profile.verification_submitted_at && (
                        <div className="pt-4 border-t border-gray-200">
                          <p className="text-xs text-gray-500">
                            {preferredLanguage === 'fr' ? 'Soumis le' : 'Submitted on'} {new Date(profile.verification_submitted_at).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      )}

                      {profile.verification_status === 'approved' && (
                        <div className="mt-4 bg-white rounded-xl p-4 border border-green-200">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <span className="text-sm font-semibold text-green-700">
                              {preferredLanguage === 'fr' ? 'Accès complet aux fonctionnalités' : 'Full access to all features'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">
                      Informations du compte
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
                        <Mail className="w-5 h-5 text-gray-400" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Email</p>
                          <p className="text-sm font-medium text-gray-900 break-all">{user?.email}</p>
                        </div>
                      </div>
                      {phone && (
                        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
                          <Phone className="w-5 h-5 text-gray-400" />
                          <div className="flex-1">
                            <p className="text-xs text-gray-500">Téléphone</p>
                            <p className="text-sm font-medium text-gray-900">{countryCode} {phone}</p>
                          </div>
                        </div>
                      )}
                      {profile.email_verified && (
                        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-green-700">
                              {preferredLanguage === 'fr' ? 'Email vérifié' : 'Email verified'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {profile.role === 'student' && profile.verification_document_url && (
                    <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border border-gray-100 shadow-sm">
                      <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {preferredLanguage === 'fr' ? 'Mon document' : 'My document'}
                      </h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
                          <FileText className="w-5 h-5 text-purple-500" />
                          <div className="flex-1">
                            <p className="text-xs text-gray-500">
                              {preferredLanguage === 'fr' ? 'Attestation INSEAD' : 'INSEAD Certificate'}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {profile.verification_status === 'approved' && (
                                <span className="text-xs font-medium text-green-600 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  {preferredLanguage === 'fr' ? 'Approuvé' : 'Approved'}
                                </span>
                              )}
                              {profile.verification_status === 'pending' && (
                                <span className="text-xs font-medium text-orange-600 flex items-center gap-1">
                                  <ClockIcon className="w-3 h-3" />
                                  {preferredLanguage === 'fr' ? 'En attente' : 'Pending'}
                                </span>
                              )}
                              {profile.verification_status === 'rejected' && (
                                <span className="text-xs font-medium text-red-600 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  {preferredLanguage === 'fr' ? 'Refusé' : 'Rejected'}
                                </span>
                              )}
                            </div>
                          </div>
                          <a
                            href={profile.verification_document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-gray-100 rounded-lg transition"
                          >
                            <Eye className="w-4 h-4 text-gray-600" />
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {profile.role === 'landlord' && landlordDocuments.length > 0 && (
                    <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border border-gray-100 shadow-sm">
                      <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {preferredLanguage === 'fr' ? 'Mes documents' : 'My documents'}
                      </h3>
                      <div className="space-y-2">
                        {landlordDocuments.map((doc) => (
                          <div key={doc.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
                            <FileText className="w-5 h-5 text-blue-500" />
                            <div className="flex-1">
                              <p className="text-xs text-gray-500">
                                {doc.document_type === 'identity_document'
                                  ? (preferredLanguage === 'fr' ? 'Pièce d\'identité' : 'ID Document')
                                  : (preferredLanguage === 'fr' ? 'Taxe foncière' : 'Property Tax')}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {doc.verification_status === 'approved' && (
                                  <span className="text-xs font-medium text-green-600 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" />
                                    {preferredLanguage === 'fr' ? 'Approuvé' : 'Approved'}
                                  </span>
                                )}
                                {doc.verification_status === 'pending' && (
                                  <span className="text-xs font-medium text-orange-600 flex items-center gap-1">
                                    <ClockIcon className="w-3 h-3" />
                                    {preferredLanguage === 'fr' ? 'En attente' : 'Pending'}
                                  </span>
                                )}
                                {doc.verification_status === 'rejected' && (
                                  <span className="text-xs font-medium text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {preferredLanguage === 'fr' ? 'Refusé' : 'Rejected'}
                                  </span>
                                )}
                              </div>
                            </div>
                            <a
                              href={doc.document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-gray-100 rounded-lg transition"
                            >
                              <Eye className="w-4 h-4 text-gray-600" />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 flex gap-4">
                <button
                  type="submit"
                  disabled={loading || (profile.role === 'student' && !avatarPreview) || (profile.role === 'student' && profile.verification_status === 'not_submitted' && !verificationFile)}
                  className="flex-1 py-4 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold rounded-xl hover:from-rose-600 hover:to-pink-700 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  {loading ? t('common.loading') : t('profile.save')}
                </button>
              </div>

              {profile.role === 'student' && (!avatarPreview || (profile.verification_status === 'not_submitted' && !verificationFile)) && (
                <p className="text-sm text-rose-600 text-center mt-4 flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {!avatarPreview
                    ? (preferredLanguage === 'fr' ? 'Une photo de profil est obligatoire' : 'Profile photo is required')
                    : (preferredLanguage === 'fr' ? 'Veuillez télécharger votre attestation de scolarité pour continuer' : 'Please upload your school certificate to continue')}
                </p>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
