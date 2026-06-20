import { useState, useRef } from 'react';
import { CheckCircle2, Circle, Clock, AlertCircle, Upload, User as UserIcon, Phone, ArrowRight, X, Camera, FileText, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'urgent' | 'important' | 'normal';
  status: 'pending' | 'completed' | 'snoozed';
  task_type: 'system' | 'custom';
  due_date?: string;
  related_entity_type?: string;
  related_entity_id?: string;
}

interface TaskCardProps {
  task: Task;
  onTaskUpdate?: () => void;
}

interface VerificationTaskAction {
  label: string;
  route: string;
  icon: typeof Upload | typeof UserIcon | typeof Phone;
  actionType: 'upload_avatar' | 'add_phone' | 'upload_document' | 'navigate';
  documentType?: 'insead_attestation' | 'id_document' | 'property_tax';
}

const verificationTaskActions: Record<string, VerificationTaskAction> = {
  'Ajouter une photo de profil': {
    label: 'Télécharger la photo',
    route: '/profil',
    icon: Camera,
    actionType: 'upload_avatar'
  },
  'Ajouter votre numéro de téléphone': {
    label: 'Ajouter mon téléphone',
    route: '/profil',
    icon: Phone,
    actionType: 'add_phone'
  },
  'Télécharger votre justificatif d\'identité': {
    label: 'Télécharger le document',
    route: '/documents-proprietaire',
    icon: Upload,
    actionType: 'upload_document',
    documentType: 'id_document'
  },
  'Télécharger votre taxe foncière': {
    label: 'Télécharger le document',
    route: '/documents-proprietaire',
    icon: Upload,
    actionType: 'upload_document',
    documentType: 'property_tax'
  },
  'Télécharger votre attestation INSEAD': {
    label: 'Télécharger le document',
    route: '/mes-documents',
    icon: Upload,
    actionType: 'upload_document',
    documentType: 'insead_attestation'
  },
  'Configurer votre compte de paiement Stripe': {
    label: 'Configurer Stripe',
    route: '/proprietaire/paiements',
    icon: CreditCard,
    actionType: 'navigate'
  }
};

export default function TaskCard({ task, onTaskUpdate }: TaskCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+33');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { profile, updateProfile, refreshProfile } = useAuth();

  const countries = [
    { code: '+33', flag: '🇫🇷', name: 'France' },
    { code: '+1', flag: '🇺🇸', name: 'USA' },
    { code: '+44', flag: '🇬🇧', name: 'UK' },
    { code: '+49', flag: '🇩🇪', name: 'Allemagne' },
  ];

  const priorityConfig = {
    urgent: {
      border: 'border-red-500',
      bg: 'bg-red-50',
      text: 'text-red-700',
      badge: 'bg-red-500',
      icon: AlertCircle
    },
    important: {
      border: 'border-orange-500',
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      badge: 'bg-orange-500',
      icon: Clock
    },
    normal: {
      border: 'border-blue-500',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      badge: 'bg-blue-500',
      icon: Circle
    }
  };

  const config = priorityConfig[task.priority];
  const PriorityIcon = config.icon;

  const isVerificationTask = task.title in verificationTaskActions;
  const verificationAction = verificationTaskActions[task.title];
  const isCompleted = task.status === 'completed';

  const handleToggleComplete = async () => {
    if (isVerificationTask && !isCompleted) {
      return;
    }

    setIsUpdating(true);
    try {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      const { error } = await supabase
        .from('tasks')
        .update({
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', task.id);

      if (error) throw error;

      if (newStatus === 'completed') {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1000);
      }

      if (onTaskUpdate) onTaskUpdate();
    } catch (error) {
      console.error('Error updating task:', error);
    } finally {
      setIsUpdating(false);
    }
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

  const uploadDocument = async (file: File, documentType: string) => {
    if (!profile) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${profile.id}-${documentType}-${Date.now()}.${fileExt}`;
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (verificationAction.actionType === 'upload_avatar') {
      if (!file.type.startsWith('image/')) {
        setError('Veuillez sélectionner une image');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('La photo doit faire moins de 5 MB');
        return;
      }
    } else if (verificationAction.actionType === 'upload_document') {
      if (file.type !== 'application/pdf') {
        setError('Veuillez sélectionner un fichier PDF');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('Le document doit faire moins de 10 MB');
        return;
      }
    }

    setSelectedFile(file);
    setError('');
  };

  const handleUpload = async () => {
    if (!selectedFile || !profile) return;

    setUploading(true);
    setError('');

    try {
      if (verificationAction.actionType === 'upload_avatar') {
        const avatarUrl = await uploadAvatar(selectedFile);
        await updateProfile({ avatar_url: avatarUrl || undefined });
      } else if (verificationAction.actionType === 'upload_document') {
        const documentUrl = await uploadDocument(selectedFile, verificationAction.documentType!);
        const storagePath = documentUrl?.split('/documents/')[1] || '';

        if (verificationAction.documentType === 'insead_attestation') {
          await updateProfile({
            verification_document_url: documentUrl || undefined,
            verification_status: 'pending',
            verification_submitted_at: new Date().toISOString()
          });

          const existingDoc = await supabase
            .from('student_documents')
            .select('id')
            .eq('student_id', profile.id)
            .eq('document_type', 'insead_attestation')
            .maybeSingle();

          if (existingDoc.data) {
            const { error: updateErr } = await supabase
              .from('student_documents')
              .update({
                file_url: storagePath,
                file_name: selectedFile.name,
                status: 'pending',
                uploaded_at: new Date().toISOString(),
              })
              .eq('id', existingDoc.data.id);
            if (updateErr) throw updateErr;
          } else {
            const { error: insertErr } = await supabase.from('student_documents').insert({
              student_id: profile.id,
              document_type: 'insead_attestation',
              file_url: storagePath,
              file_name: selectedFile.name,
              status: 'pending',
            });
            if (insertErr) throw insertErr;
          }
        } else {
          const documentTypeMap: Record<string, string> = {
            'id_document': 'id_card',
            'property_tax': 'property_tax'
          };
          const dbDocType = documentTypeMap[verificationAction.documentType!];

          const existingDoc = await supabase
            .from('landlord_documents')
            .select('id')
            .eq('landlord_id', profile.id)
            .eq('document_type', dbDocType)
            .is('listing_id', null)
            .maybeSingle();

          if (existingDoc.data) {
            const { error: updateErr } = await supabase
              .from('landlord_documents')
              .update({
                file_url: storagePath,
                file_name: selectedFile.name,
                status: 'pending',
                uploaded_at: new Date().toISOString(),
              })
              .eq('id', existingDoc.data.id);
            if (updateErr) throw updateErr;
          } else {
            const { error: insertErr } = await supabase.from('landlord_documents').insert({
              landlord_id: profile.id,
              document_type: dbDocType,
              file_url: storagePath,
              file_name: selectedFile.name,
              status: 'pending',
            });
            if (insertErr) throw insertErr;
          }
        }
      }

      await refreshProfile();
      setShowModal(false);
      setSelectedFile(null);

      if (onTaskUpdate) onTaskUpdate();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setUploading(false);
    }
  };

  const handleAddPhone = async () => {
    if (!phone || !profile) return;

    setUploading(true);
    setError('');

    try {
      await updateProfile({ phone: `${countryCode}${phone}` });
      await refreshProfile();
      setShowModal(false);
      setPhone('');

      if (onTaskUpdate) onTaskUpdate();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setUploading(false);
    }
  };

  const handleActionClick = () => {
    if (!verificationAction) return;

    if (verificationAction.actionType === 'navigate') {
      navigate(verificationAction.route);
    } else {
      setShowModal(true);
    }
  };

  const renderModalContent = () => {
    if (!verificationAction) return null;

    if (verificationAction.actionType === 'add_phone') {
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Numéro de téléphone
            </label>
            <div className="flex">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="px-3 py-3 border border-gray-200 rounded-l-xl bg-white focus:ring-2 focus:ring-rose-400 focus:border-transparent"
              >
                {countries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.flag} {country.code}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="6 12 34 56 78"
                className="flex-1 px-4 py-3 border border-l-0 border-gray-200 rounded-r-xl focus:ring-2 focus:ring-rose-400 focus:border-transparent"
              />
            </div>
          </div>
          <button
            onClick={handleAddPhone}
            disabled={!phone || uploading}
            className="w-full py-3 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-pink-700 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {uploading ? 'Ajout en cours...' : 'Ajouter mon téléphone'}
          </button>
        </div>
      );
    }

    if (verificationAction.actionType === 'upload_avatar' || verificationAction.actionType === 'upload_document') {
      return (
        <div className="space-y-4">
          {!selectedFile ? (
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-rose-400 bg-gray-50 transition cursor-pointer group">
              <input
                ref={fileInputRef}
                type="file"
                accept={verificationAction.actionType === 'upload_avatar' ? 'image/*' : '.pdf'}
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center"
              >
                <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-rose-100 transition">
                  {verificationAction.actionType === 'upload_avatar' ? (
                    <Camera className="h-8 w-8 text-rose-500" />
                  ) : (
                    <Upload className="h-8 w-8 text-rose-500" />
                  )}
                </div>
                <span className="text-base font-semibold text-gray-900 mb-2">
                  {verificationAction.actionType === 'upload_avatar'
                    ? 'Cliquez pour sélectionner une photo'
                    : 'Cliquez pour sélectionner un document PDF'}
                </span>
                <span className="text-sm text-gray-500">
                  {verificationAction.actionType === 'upload_avatar'
                    ? 'Format image • Max 5 MB'
                    : 'Format PDF uniquement • Max 10 MB'}
                </span>
              </button>
            </div>
          ) : (
            <div className="bg-green-50 border-2 border-green-300 rounded-xl p-5">
              <div className="flex items-center space-x-4 mb-4">
                <div className="bg-green-100 p-3 rounded-xl">
                  <FileText className="h-7 w-7 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-semibold text-gray-900">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-rose-600 hover:text-rose-700 p-2 hover:bg-white rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full py-3 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-pink-700 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Upload className="w-5 h-5" />
                {uploading ? 'Téléchargement en cours...' : 'Télécharger'}
              </button>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <div
        className={`relative border-l-4 ${config.border} ${isCompleted ? 'bg-green-50 border-green-500' : config.bg} rounded-r-xl p-4 transition-all duration-300 hover:shadow-md ${isUpdating ? 'opacity-50' : ''}`}
      >
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="animate-ping absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-4xl">
              🎉
            </div>
          </div>
        )}

        <div className="flex items-start gap-3">
          <button
            onClick={handleToggleComplete}
            disabled={isUpdating || (isVerificationTask && !isCompleted)}
            className={`flex-shrink-0 mt-0.5 focus:outline-none transition-transform ${
              isVerificationTask && !isCompleted
                ? 'cursor-not-allowed opacity-50'
                : 'hover:scale-110'
            }`}
          >
            {isCompleted ? (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            ) : (
              <Circle className={`h-6 w-6 ${
                isVerificationTask
                  ? 'text-gray-300'
                  : 'text-gray-400 hover:text-rose-500'
              }`} />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className={`font-semibold text-gray-900 ${isCompleted ? 'line-through text-gray-500' : ''}`}>
                {task.title}
              </h3>
              {!isCompleted && (
                <span className={`${config.badge} text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 flex-shrink-0`}>
                  <PriorityIcon className="h-3 w-3" />
                  {task.priority === 'urgent' ? 'Urgent' : task.priority === 'important' ? 'Important' : 'Normal'}
                </span>
              )}
            </div>

            {task.description && (
              <p className={`text-sm text-gray-600 mb-2 ${isCompleted ? 'line-through' : ''}`}>
                {task.description}
              </p>
            )}

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {task.due_date && !isCompleted && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(task.due_date).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short'
                    })}
                  </span>
                )}
                {task.task_type === 'system' && (
                  <span className="bg-gray-200 px-2 py-0.5 rounded">Automatique</span>
                )}
              </div>

              {isVerificationTask && !isCompleted && verificationAction && (
                <button
                  onClick={handleActionClick}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm hover:shadow-md"
                >
                  {(() => {
                    const ActionIcon = verificationAction.icon;
                    return <ActionIcon className="h-4 w-4" />;
                  })()}
                  {verificationAction.label}
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 relative">
            <button
              onClick={() => {
                setShowModal(false);
                setSelectedFile(null);
                setPhone('');
                setError('');
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {task.title}
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              {task.description || 'Complétez cette action pour valider votre compte'}
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {renderModalContent()}
          </div>
        </div>
      )}
    </>
  );
}
