import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, CheckCircle, Clock, XCircle, Download, Trash2, AlertCircle, Check, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

type Document = {
  id: string;
  document_type: string;
  file_url: string;
  file_name: string;
  uploaded_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_correction';
  admin_notes?: string;
};

type DocumentType = {
  id: string;
  labelFr: string;
  labelEn: string;
  descriptionFr: string;
  descriptionEn: string;
  required: boolean;
  acceptedFormats: string;
  category: 'required' | 'insurance' | 'signed';
};

export default function MyDocuments() {
  const { profile, user } = useAuth();
  const { t, language } = useLanguage();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [uploadedDocType, setUploadedDocType] = useState<string>('');
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const documentTypes: DocumentType[] = [
    {
      id: 'id_card_front',
      labelFr: 'Pièce d\'identité (Recto)',
      labelEn: 'ID Card (Front)',
      descriptionFr: 'Photo ou scan du recto de votre carte d\'identité ou passeport',
      descriptionEn: 'Photo or scan of the front of your ID card or passport',
      required: true,
      acceptedFormats: 'PDF, JPG, PNG (max 5MB)',
      category: 'required',
    },
    {
      id: 'id_card_back',
      labelFr: 'Pièce d\'identité (Verso)',
      labelEn: 'ID Card (Back)',
      descriptionFr: 'Photo ou scan du verso de votre carte d\'identité',
      descriptionEn: 'Photo or scan of the back of your ID card',
      required: true,
      acceptedFormats: 'PDF, JPG, PNG (max 5MB)',
      category: 'required',
    },
    {
      id: 'accommodation_certificate',
      labelFr: 'Attestation d\'hébergement',
      labelEn: 'Accommodation Certificate',
      descriptionFr: 'Document attestant de votre hébergement actuel ou précédent',
      descriptionEn: 'Document certifying your current or previous accommodation',
      required: true,
      acceptedFormats: 'PDF (max 5MB)',
      category: 'required',
    },
    {
      id: 'insurance_certificate',
      labelFr: 'Attestation d\'assurance habitation',
      labelEn: 'Home Insurance Certificate',
      descriptionFr: 'À fournir après validation de la réservation et paiement',
      descriptionEn: 'To be provided after booking confirmation and payment',
      required: false,
      acceptedFormats: 'PDF (max 5MB)',
      category: 'insurance',
    },
    {
      id: 'lease_copy',
      labelFr: 'Copie du bail signé',
      labelEn: 'Signed Lease Copy',
      descriptionFr: 'Le bail sera disponible ici une fois signé par toutes les parties',
      descriptionEn: 'The lease will be available here once signed by all parties',
      required: false,
      acceptedFormats: 'PDF',
      category: 'signed',
    },
    {
      id: 'inventory_copy',
      labelFr: 'État des lieux d\'entrée',
      labelEn: 'Entry Inventory',
      descriptionFr: 'L\'état des lieux sera disponible ici une fois complété',
      descriptionEn: 'The inventory will be available here once completed',
      required: false,
      acceptedFormats: 'PDF',
      category: 'signed',
    },
  ];

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('student_documents')
        .select('*')
        .eq('student_id', user.id)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (err: any) {
      console.error('Error loading documents:', err);
      setError('Erreur lors du chargement des documents');
    } finally {
      setLoading(false);
    }
  };

  const notifyAdmin = async (documentType: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-document-notification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: user?.id,
          documentType,
        }),
      });
    } catch (err) {
      console.error('Error notifying admin:', err);
    }
  };

  const handleFileSelect = async (documentType: string, file: File) => {
    if (!file || !user) return;

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Le fichier ne doit pas dépasser 5MB');
      setTimeout(() => setError(''), 5000);
      return;
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setError(t('myDocuments.fileTypeError'));
      setTimeout(() => setError(''), 5000);
      return;
    }

    setError('');
    setSuccess('');
    setUploading(documentType);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${documentType}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('student-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('student-documents')
        .getPublicUrl(fileName);

      const existingDoc = documents.find(d => d.document_type === documentType);

      if (existingDoc) {
        const oldFileName = existingDoc.file_url.split('/').pop();
        if (oldFileName) {
          await supabase.storage
            .from('student-documents')
            .remove([`${user.id}/${oldFileName}`]);
        }

        const { error: updateError } = await supabase
          .from('student_documents')
          .update({
            file_url: publicUrl,
            file_name: file.name,
            uploaded_at: new Date().toISOString(),
            status: 'pending',
          })
          .eq('id', existingDoc.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('student_documents')
          .insert({
            student_id: user.id,
            document_type: documentType,
            file_url: publicUrl,
            file_name: file.name,
            status: 'pending',
          });

        if (insertError) throw insertError;
      }

      await notifyAdmin(documentType);

      setUploadedDocType(documentType);
      setShowSuccessModal(true);
      await loadDocuments();
    } catch (err: any) {
      console.error('Upload error:', err);
      setError('Erreur lors de l\'upload : ' + err.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setUploading(null);
      if (fileInputRefs.current[documentType]) {
        fileInputRefs.current[documentType]!.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent, documentType: string) => {
    e.preventDefault();
    setDragOver(null);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(documentType, file);
    }
  };

  const handleDragOver = (e: React.DragEvent, documentType: string) => {
    e.preventDefault();
    setDragOver(documentType);
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;

    try {
      const fileName = doc.file_url.split('/').pop();
      if (fileName && user) {
        await supabase.storage
          .from('student-documents')
          .remove([`${user.id}/${fileName}`]);
      }

      const { error } = await supabase
        .from('student_documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;

      setSuccess('Document supprimé avec succès');
      setTimeout(() => setSuccess(''), 3000);
      await loadDocuments();
    } catch (err: any) {
      setError('Erreur lors de la suppression : ' + err.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const response = await fetch(doc.file_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Erreur lors du téléchargement');
      setTimeout(() => setError(''), 5000);
    }
  };

  const getDocumentByType = (type: string) => {
    return documents.find(d => d.document_type === type);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-orange-500 animate-pulse" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'needs_correction':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return language === 'fr' ? 'Approuvé' : 'Approved';
      case 'pending':
        return language === 'fr' ? 'En attente' : 'Pending';
      case 'rejected':
        return language === 'fr' ? 'Rejeté' : 'Rejected';
      case 'needs_correction':
        return language === 'fr' ? 'À corriger' : 'Needs Correction';
      default:
        return '';
    }
  };

  const getProgress = () => {
    const requiredDocs = documentTypes.filter(d => d.required);
    const uploadedRequired = requiredDocs.filter(dt => {
      const doc = getDocumentByType(dt.id);
      return doc && doc.status !== 'rejected';
    });
    return Math.round((uploadedRequired.length / requiredDocs.length) * 100);
  };

  const requiredDocs = documentTypes.filter(d => d.category === 'required');
  const insuranceDocs = documentTypes.filter(d => d.category === 'insurance');
  const signedDocs = documentTypes.filter(d => d.category === 'signed');

  if (profile?.role !== 'student') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 text-center shadow-xl">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Accès réservé aux étudiants
          </h2>
          <p className="text-gray-600">
            Cette page est uniquement accessible aux comptes étudiants.
          </p>
        </div>
      </div>
    );
  }

  const SuccessModal = () => {
    const docType = documentTypes.find(d => d.id === uploadedDocType);

    return (
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
        onClick={() => setShowSuccessModal(false)}
      >
        <div
          className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl transform animate-in zoom-in duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-500 delay-100">
              <Check className="w-12 h-12 text-green-600 animate-in zoom-in duration-300 delay-300" />
            </div>

            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              {language === 'fr' ? 'Document envoyé !' : 'Document sent!'}
            </h3>

            <p className="text-gray-600 mb-2">
              <strong>{language === 'fr' ? docType?.labelFr : docType?.labelEn}</strong>
            </p>

            <p className="text-gray-600 mb-6">
              {language === 'fr'
                ? 'Votre document a été envoyé avec succès. Notre équipe le vérifiera dans les plus brefs délais.'
                : 'Your document has been successfully sent. Our team will review it as soon as possible.'}
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 w-full">
              <p className="text-sm text-blue-900 font-medium">
                {language === 'fr'
                  ? '📧 Une notification a été envoyée à nos administrateurs'
                  : '📧 A notification has been sent to our administrators'}
              </p>
            </div>

            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full px-6 py-3 bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition font-semibold"
            >
              {language === 'fr' ? 'Parfait !' : 'Great!'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ProgressBar = () => {
    const progress = getProgress();

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {language === 'fr' ? 'Progression des documents' : 'Document Progress'}
            </h3>
            <p className="text-sm text-gray-600">
              {language === 'fr'
                ? 'Documents obligatoires complétés'
                : 'Required documents completed'}
            </p>
          </div>
          <div className="text-3xl font-bold text-rose-500">
            {progress}%
          </div>
        </div>

        <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-1000 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          </div>
        </div>
      </div>
    );
  };

  const DocumentCard = ({ docType }: { docType: DocumentType }) => {
    const doc = getDocumentByType(docType.id);
    const isUploading = uploading === docType.id;
    const isDragging = dragOver === docType.id;

    return (
      <div
        className={`border-2 rounded-xl p-5 transition-all duration-300 ${
          isDragging
            ? 'border-rose-500 bg-rose-50 scale-105 shadow-lg'
            : doc
              ? 'border-gray-200 hover:border-rose-300 hover:shadow-md'
              : 'border-dashed border-gray-300 hover:border-rose-400 hover:bg-rose-50/50'
        }`}
        onDrop={(e) => handleDrop(e, docType.id)}
        onDragOver={(e) => handleDragOver(e, docType.id)}
        onDragLeave={handleDragLeave}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 mb-1">
              {language === 'fr' ? docType.labelFr : docType.labelEn}
              {docType.required && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </h3>
            <p className="text-xs text-gray-600 mb-2">
              {language === 'fr' ? docType.descriptionFr : docType.descriptionEn}
            </p>
            <p className="text-xs text-gray-500">{docType.acceptedFormats}</p>
          </div>
          {doc && getStatusIcon(doc.status)}
        </div>

        {doc ? (
          <div className="space-y-3">
            <div className={`rounded-lg p-3 transition-colors ${
              doc.status === 'approved' ? 'bg-green-50 border border-green-200' :
              doc.status === 'pending' ? 'bg-orange-50 border border-orange-200' :
              doc.status === 'needs_correction' ? 'bg-yellow-50 border border-yellow-200' :
              'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-900 truncate flex-1">
                  {doc.file_name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  doc.status === 'approved' ? 'bg-green-100 text-green-700' :
                  doc.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                  doc.status === 'needs_correction' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {getStatusText(doc.status)}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(doc.uploaded_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}
                </span>
              </div>
            </div>

            {doc.admin_notes && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 animate-in slide-in-from-top duration-300">
                <p className="text-xs font-semibold text-yellow-900 mb-1">
                  {language === 'fr' ? 'Note de l\'administrateur :' : 'Admin note:'}
                </p>
                <p className="text-xs text-yellow-800">{doc.admin_notes}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => handleDownload(doc)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                {language === 'fr' ? 'Télécharger' : 'Download'}
              </button>
              <button
                onClick={() => handleDelete(doc)}
                className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm font-semibold flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <input
              ref={(el) => fileInputRefs.current[docType.id] = el}
              type="file"
              accept={docType.category === 'insurance' ? '.pdf' : '.pdf,.jpg,.jpeg,.png'}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(docType.id, file);
              }}
              className="hidden"
            />
            <button
              onClick={() => fileInputRefs.current[docType.id]?.click()}
              disabled={isUploading}
              className="w-full px-4 py-2 border-2 border-rose-300 text-rose-600 rounded-lg hover:bg-rose-50 transition text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading
                ? (language === 'fr' ? 'Upload...' : 'Uploading...')
                : (language === 'fr' ? 'Remplacer' : 'Replace')}
            </button>
          </div>
        ) : (
          <div>
            <input
              ref={(el) => fileInputRefs.current[docType.id] = el}
              type="file"
              accept={docType.category === 'insurance' ? '.pdf' : '.pdf,.jpg,.jpeg,.png'}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(docType.id, file);
              }}
              className="hidden"
            />

            {isDragging ? (
              <div className="py-8 text-center">
                <Upload className="w-12 h-12 text-rose-500 mx-auto mb-3 animate-bounce" />
                <p className="text-sm font-semibold text-rose-600">
                  {language === 'fr' ? 'Déposez le fichier ici' : 'Drop the file here'}
                </p>
              </div>
            ) : (
              <button
                onClick={() => fileInputRefs.current[docType.id]?.click()}
                disabled={isUploading}
                className="w-full px-4 py-8 bg-gradient-to-br from-rose-500 to-pink-500 text-white rounded-xl hover:from-rose-600 hover:to-pink-600 transition font-semibold flex flex-col items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-sm">
                      {language === 'fr' ? 'Upload en cours...' : 'Uploading...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8" />
                    <div>
                      <div className="text-base mb-1">
                        {language === 'fr' ? 'Uploader' : 'Upload'}
                      </div>
                      <div className="text-xs font-normal opacity-90">
                        {language === 'fr' ? 'ou glissez-déposez' : 'or drag & drop'}
                      </div>
                    </div>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {language === 'fr' ? 'Mes documents' : 'My Documents'}
          </h1>
          <p className="text-gray-600">
            {language === 'fr'
              ? 'Gérez tous vos documents nécessaires pour la location'
              : 'Manage all your documents required for rental'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-3 animate-in slide-in-from-top duration-300">
            <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl flex items-start gap-3 animate-in slide-in-from-top duration-300">
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <ProgressBar />

        <div className="space-y-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-rose-100 p-3 rounded-xl">
                <FileText className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {language === 'fr' ? 'Documents obligatoires' : 'Required Documents'}
                </h2>
                <p className="text-sm text-gray-600">
                  {language === 'fr'
                    ? 'Ces documents sont nécessaires pour toute réservation'
                    : 'These documents are required for any booking'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {requiredDocs.map((docType) => (
                <DocumentCard key={docType.id} docType={docType} />
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-blue-100 p-3 rounded-xl">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {language === 'fr' ? 'Assurance habitation' : 'Home Insurance'}
                </h2>
                <p className="text-sm text-gray-600">
                  {language === 'fr'
                    ? 'À fournir après confirmation de réservation'
                    : 'To be provided after booking confirmation'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {insuranceDocs.map((docType) => (
                <DocumentCard key={docType.id} docType={docType} />
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-green-100 p-3 rounded-xl">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {language === 'fr' ? 'Documents signés' : 'Signed Documents'}
                </h2>
                <p className="text-sm text-gray-600">
                  {language === 'fr'
                    ? 'Vos documents officiels une fois signés'
                    : 'Your official documents once signed'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {signedDocs.map((docType) => {
                const doc = getDocumentByType(docType.id);
                return (
                  <div
                    key={docType.id}
                    className="border-2 border-gray-200 rounded-xl p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 mb-1">
                          {language === 'fr' ? docType.labelFr : docType.labelEn}
                        </h3>
                        <p className="text-xs text-gray-600 mb-2">
                          {language === 'fr' ? docType.descriptionFr : docType.descriptionEn}
                        </p>
                      </div>
                    </div>

                    {doc ? (
                      <div className="space-y-3">
                        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-900 truncate flex-1">
                              {doc.file_name}
                            </p>
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(doc.uploaded_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}
                          </span>
                        </div>

                        <button
                          onClick={() => handleDownload(doc)}
                          className="w-full px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-semibold flex items-center justify-center gap-2"
                        >
                          <Download className="w-5 h-5" />
                          {language === 'fr' ? 'Télécharger' : 'Download'}
                        </button>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          {language === 'fr'
                            ? 'Pas encore disponible'
                            : 'Not yet available'}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showSuccessModal && <SuccessModal />}
    </div>
  );
}
