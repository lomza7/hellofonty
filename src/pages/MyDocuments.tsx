import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, CheckCircle, Clock, XCircle, Download, Trash2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';

type Document = {
  id: string;
  document_type: string;
  file_url: string;
  file_name: string;
  uploaded_at: string;
  status: 'pending' | 'approved' | 'rejected';
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

  const handleFileSelect = async (documentType: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Le fichier ne doit pas dépasser 5MB');
      return;
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setError(t('myDocuments.fileTypeError'));
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

      const fileUrl = fileName;

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
            file_url: fileUrl,
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
            file_url: fileUrl,
            file_name: file.name,
            status: 'pending',
          });

        if (insertError) throw insertError;
      }

      setSuccess('Document uploadé avec succès !');
      await loadDocuments();
    } catch (err: any) {
      console.error('Upload error:', err);
      setError('Erreur lors de l\'upload : ' + err.message);
    } finally {
      setUploading(null);
      if (fileInputRefs.current[documentType]) {
        fileInputRefs.current[documentType]!.value = '';
      }
    }
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
      await loadDocuments();
    } catch (err: any) {
      setError('Erreur lors de la suppression : ' + err.message);
    }
  };

  const extractFilePath = (fileUrl: string, bucketName: string): string => {
    // Si c'est déjà un chemin (pas d'URL complète), le retourner tel quel
    if (!fileUrl.includes('http')) {
      return fileUrl;
    }

    // Extraire le chemin depuis une URL Supabase
    const parts = fileUrl.split(`/${bucketName}/`);
    if (parts.length > 1) {
      return parts[1];
    }

    return fileUrl;
  };

  const getSignedUrl = async (filePath: string): Promise<string> => {
    const cleanPath = extractFilePath(filePath, 'student-documents');
    const { data, error } = await supabase.storage
      .from('student-documents')
      .createSignedUrl(cleanPath, 3600);

    if (error) throw error;
    return data.signedUrl;
  };

  const handleDownload = async (doc: Document) => {
    try {
      const signedUrl = await getSignedUrl(doc.file_url);
      const response = await fetch(signedUrl);
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
      default:
        return '';
    }
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

  return (
    <div className="min-h-screen bg-gray-50 py-12">
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
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-3">
            <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl flex items-start gap-3">
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

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
              {requiredDocs.map((docType) => {
                const doc = getDocumentByType(docType.id);
                return (
                  <div
                    key={docType.id}
                    className="border-2 border-gray-200 rounded-xl p-5 hover:border-rose-300 transition"
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
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-900 truncate flex-1">
                              {doc.file_name}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              doc.status === 'approved' ? 'bg-green-100 text-green-700' :
                              doc.status === 'pending' ? 'bg-orange-100 text-orange-700' :
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
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
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
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileSelect(docType.id, e)}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRefs.current[docType.id]?.click()}
                          disabled={uploading === docType.id}
                          className="w-full px-4 py-2 border-2 border-rose-300 text-rose-600 rounded-lg hover:bg-rose-50 transition text-sm font-semibold disabled:opacity-50"
                        >
                          {uploading === docType.id
                            ? (language === 'fr' ? 'Upload...' : 'Uploading...')
                            : (language === 'fr' ? 'Remplacer' : 'Replace')}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <input
                          ref={(el) => fileInputRefs.current[docType.id] = el}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileSelect(docType.id, e)}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRefs.current[docType.id]?.click()}
                          disabled={uploading === docType.id}
                          className="w-full px-4 py-3 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Upload className="w-5 h-5" />
                          {uploading === docType.id
                            ? (language === 'fr' ? 'Upload en cours...' : 'Uploading...')
                            : (language === 'fr' ? 'Uploader' : 'Upload')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
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
              {insuranceDocs.map((docType) => {
                const doc = getDocumentByType(docType.id);
                return (
                  <div
                    key={docType.id}
                    className="border-2 border-gray-200 rounded-xl p-5 hover:border-blue-300 transition"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 mb-1">
                          {language === 'fr' ? docType.labelFr : docType.labelEn}
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
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-900 truncate flex-1">
                              {doc.file_name}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              doc.status === 'approved' ? 'bg-green-100 text-green-700' :
                              doc.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {getStatusText(doc.status)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(doc.uploaded_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}
                            </span>
                          </div>
                        </div>

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
                          accept=".pdf"
                          onChange={(e) => handleFileSelect(docType.id, e)}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRefs.current[docType.id]?.click()}
                          disabled={uploading === docType.id}
                          className="w-full px-4 py-2 border-2 border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition text-sm font-semibold disabled:opacity-50"
                        >
                          {uploading === docType.id
                            ? (language === 'fr' ? 'Upload...' : 'Uploading...')
                            : (language === 'fr' ? 'Remplacer' : 'Replace')}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <input
                          ref={(el) => fileInputRefs.current[docType.id] = el}
                          type="file"
                          accept=".pdf"
                          onChange={(e) => handleFileSelect(docType.id, e)}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRefs.current[docType.id]?.click()}
                          disabled={uploading === docType.id}
                          className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Upload className="w-5 h-5" />
                          {uploading === docType.id
                            ? (language === 'fr' ? 'Upload en cours...' : 'Uploading...')
                            : (language === 'fr' ? 'Uploader' : 'Upload')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
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
    </div>
  );
}
