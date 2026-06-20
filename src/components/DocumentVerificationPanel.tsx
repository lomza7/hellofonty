import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Eye, CheckCircle, XCircle, User, Home, Calendar, Search } from 'lucide-react';

interface StudentDocument {
  id: string;
  student_id: string;
  booking_id: string | null;
  document_type: string;
  file_url: string;
  file_name: string;
  uploaded_at: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  student_name?: string;
  student_email?: string;
  type: 'student';
}

interface LandlordDocument {
  id: string;
  landlord_id: string;
  listing_id: string | null;
  document_type: string;
  file_url: string;
  file_name: string;
  uploaded_at: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  landlord_name?: string;
  landlord_email?: string;
  type: 'landlord';
}

type Document = StudentDocument | LandlordDocument;

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  // Student documents
  id_card_front: "Carte d'identité (recto)",
  id_card_back: "Carte d'identité (verso)",
  accommodation_certificate: "Certificat d'hébergement",
  insurance_certificate: "Attestation d'assurance",
  lease_copy: "Copie du bail",
  inventory_copy: "État des lieux",
  insead_attestation: "Attestation INSEAD",
  // Landlord documents
  id_card: "Carte d'identité",
  kbis: "Extrait KBIS",
  property_tax: "Taxe foncière",
  tenant_insurance: "Assurance du locataire"
};

interface DocumentVerificationPanelProps {
  onPendingCountChange?: (count: number) => void;
}

export default function DocumentVerificationPanel({ onPendingCountChange }: DocumentVerificationPanelProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedDocumentUrl, setSelectedDocumentUrl] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    if (selectedDocument) {
      loadSignedUrl(selectedDocument);
    }
  }, [selectedDocument]);

  function extractFilePath(fileUrl: string, bucketName: string): string {
    if (!fileUrl.includes('http')) {
      return fileUrl;
    }

    const parts = fileUrl.split(`/${bucketName}/`);
    if (parts.length > 1) {
      return parts[1];
    }

    return fileUrl;
  }

  function determineBucketAndPath(document: Document): { bucket: string; path: string } {
    const fileUrl = document.file_url;

    // If the file_url contains 'verification-documents/' it was uploaded to the 'documents' bucket
    if (fileUrl.startsWith('verification-documents/') || fileUrl.includes('/documents/verification-documents/')) {
      const path = fileUrl.includes('http')
        ? fileUrl.split('/documents/')[1] || fileUrl
        : fileUrl;
      return { bucket: 'documents', path };
    }

    // If it's a full URL containing /documents/ (from Profile.tsx getPublicUrl)
    if (fileUrl.includes('http') && fileUrl.includes('/documents/')) {
      const path = fileUrl.split('/documents/')[1] || fileUrl;
      return { bucket: 'documents', path };
    }

    // Default: use the type-specific bucket
    const defaultBucket = document.type === 'student' ? 'student-documents' : 'landlord-documents';
    const path = extractFilePath(fileUrl, defaultBucket);
    return { bucket: defaultBucket, path };
  }

  async function loadSignedUrl(document: Document) {
    try {
      const { bucket, path } = determineBucketAndPath(document);

      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 3600);

      if (error) {
        // Fallback: try the other bucket if first attempt fails
        const fallbackBucket = bucket === 'documents'
          ? (document.type === 'student' ? 'student-documents' : 'landlord-documents')
          : 'documents';
        const fallbackPath = bucket === 'documents'
          ? document.file_url
          : (document.file_url.startsWith('verification-documents/') ? document.file_url : `verification-documents/${document.file_url}`);

        const { data: fallbackData, error: fallbackError } = await supabase.storage
          .from(fallbackBucket)
          .createSignedUrl(fallbackPath, 3600);

        if (fallbackError) throw error;
        setSelectedDocumentUrl(fallbackData.signedUrl);
        return;
      }

      setSelectedDocumentUrl(data.signedUrl);
    } catch (error) {
      console.error('Erreur lors de la generation de l\'URL signee:', error);
      setSelectedDocumentUrl('');
    }
  }

  async function loadDocuments() {
    try {
      setLoading(true);

      // Charger les documents étudiants
      const { data: studentDocs, error: studentError } = await supabase
        .from('student_documents')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (studentError) {
        console.error('Erreur student_documents:', studentError);
        throw studentError;
      }

      // Charger les documents propriétaires
      const { data: landlordDocs, error: landlordError } = await supabase
        .from('landlord_documents')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (landlordError) {
        console.error('Erreur landlord_documents:', landlordError);
        throw landlordError;
      }

      console.log('Documents étudiants chargés:', studentDocs?.length || 0);
      console.log('Documents propriétaires chargés:', landlordDocs?.length || 0);

      // Enrichir les documents avec les noms et emails
      const enrichedStudentDocs = await Promise.all(
        (studentDocs || []).map(async (doc: any) => {
          // Récupérer le profil utilisateur
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', doc.student_id)
            .maybeSingle();

          // Récupérer l'email
          const { data: email } = await supabase.rpc('get_user_email', {
            user_id: doc.student_id
          });

          return {
            ...doc,
            type: 'student' as const,
            student_name: profile
              ? `${profile.first_name} ${profile.last_name}`
              : 'Utilisateur inconnu',
            student_email: email || 'N/A'
          };
        })
      );

      const enrichedLandlordDocs = await Promise.all(
        (landlordDocs || []).map(async (doc: any) => {
          // Récupérer le profil utilisateur
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', doc.landlord_id)
            .maybeSingle();

          // Récupérer l'email
          const { data: email } = await supabase.rpc('get_user_email', {
            user_id: doc.landlord_id
          });

          return {
            ...doc,
            type: 'landlord' as const,
            landlord_name: profile
              ? `${profile.first_name} ${profile.last_name}`
              : 'Utilisateur inconnu',
            landlord_email: email || 'N/A'
          };
        })
      );

      // Combiner et trier tous les documents
      const allDocs = [...enrichedStudentDocs, ...enrichedLandlordDocs].sort(
        (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
      );

      setDocuments(allDocs);
      const pending = allDocs.filter(d => d.status === 'pending').length;
      onPendingCountChange?.(pending);
    } catch (error) {
      console.error('Erreur lors du chargement des documents:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(document: Document) {
    if (!confirm('Approuver ce document ?')) return;

    try {
      const table = document.type === 'student' ? 'student_documents' : 'landlord_documents';

      const { error } = await supabase
        .from(table)
        .update({
          status: 'approved',
          admin_notes: 'Document approuvé',
          updated_at: new Date().toISOString()
        })
        .eq('id', document.id);

      if (error) throw error;

      const userId = document.type === 'student'
        ? (document as StudentDocument).student_id
        : (document as LandlordDocument).landlord_id;

      await supabase
        .from('profiles')
        .update({
          verification_status: 'approved',
          verification_reviewed_at: new Date().toISOString(),
        })
        .eq('id', userId);

      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'booking_confirmed',
        title: 'Document approuvé',
        message: `Votre document "${DOCUMENT_TYPE_LABELS[document.document_type]}" a été approuvé.`,
        link: document.type === 'student' ? '/mes-documents' : '/mes-documents-proprietaire'
      });

      alert('Document approuvé avec succès');
      setSelectedDocument(null);
      await loadDocuments();
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de l\'approbation');
    }
  }

  async function handleReject(document: Document) {
    if (!rejectionReason.trim()) {
      alert('Veuillez fournir une raison pour le rejet');
      return;
    }

    try {
      const table = document.type === 'student' ? 'student_documents' : 'landlord_documents';

      const { error } = await supabase
        .from(table)
        .update({
          status: 'rejected',
          admin_notes: rejectionReason,
          updated_at: new Date().toISOString()
        })
        .eq('id', document.id);

      if (error) throw error;

      const userId = document.type === 'student'
        ? (document as StudentDocument).student_id
        : (document as LandlordDocument).landlord_id;

      await supabase
        .from('profiles')
        .update({
          verification_status: 'rejected',
          verification_reviewed_at: new Date().toISOString(),
          verification_rejection_reason: rejectionReason,
        })
        .eq('id', userId);

      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'booking_cancelled',
        title: 'Document refusé',
        message: `Votre document "${DOCUMENT_TYPE_LABELS[document.document_type]}" a été refusé. Raison: ${rejectionReason}`,
        link: document.type === 'student' ? '/mes-documents' : '/mes-documents-proprietaire'
      });

      alert('Document refusé');
      setSelectedDocument(null);
      setRejectionReason('');
      await loadDocuments();
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors du rejet');
    }
  }

  const filteredDocuments = documents.filter(doc => {
    const matchesStatus = filterStatus === 'all' || doc.status === filterStatus;
    const matchesType = filterType === 'all' || doc.type === filterType;

    const name = doc.type === 'student'
      ? (doc as StudentDocument).student_name || ''
      : (doc as LandlordDocument).landlord_name || '';

    const email = doc.type === 'student'
      ? (doc as StudentDocument).student_email || ''
      : (doc as LandlordDocument).landlord_email || '';

    const matchesSearch = searchTerm === '' ||
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      DOCUMENT_TYPE_LABELS[doc.document_type]?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesStatus && matchesType && matchesSearch;
  });

  const pendingCount = documents.filter(d => d.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Titre avec bouton refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Vérification des Documents</h2>
        <button
          onClick={loadDocuments}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualiser
        </button>
      </div>

      {/* En-tête avec statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-5 border border-yellow-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-yellow-900 text-sm">En attente</h4>
            <Calendar className="w-5 h-5 text-yellow-600" />
          </div>
          <p className="text-3xl font-bold text-yellow-900">{pendingCount}</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-green-900 text-sm">Approuvés</h4>
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-green-900">
            {documents.filter(d => d.status === 'approved').length}
          </p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-5 border border-red-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-red-900 text-sm">Refusés</h4>
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-3xl font-bold text-red-900">
            {documents.filter(d => d.status === 'rejected').length}
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-blue-900 text-sm">Total</h4>
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-blue-900">{documents.length}</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher par nom, email, type de document..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-4">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            >
              <option value="all">Tous les utilisateurs</option>
              <option value="student">Étudiants</option>
              <option value="landlord">Propriétaires</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            >
              <option value="all">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="approved">Approuvés</option>
              <option value="rejected">Refusés</option>
            </select>
          </div>
        </div>
      </div>

      {/* Liste des documents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Liste */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Documents ({filteredDocuments.length})
            </h3>
          </div>

          <div className="overflow-y-auto max-h-[600px] divide-y divide-gray-200">
            {filteredDocuments.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">Aucun document trouvé</p>
              </div>
            ) : (
              filteredDocuments.map((doc) => {
                const name = doc.type === 'student'
                  ? (doc as StudentDocument).student_name
                  : (doc as LandlordDocument).landlord_name;

                const email = doc.type === 'student'
                  ? (doc as StudentDocument).student_email
                  : (doc as LandlordDocument).landlord_email;

                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDocument(doc)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedDocument?.id === doc.id ? 'bg-rose-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        doc.type === 'student' ? 'bg-blue-100' : 'bg-purple-100'
                      }`}>
                        {doc.type === 'student' ? (
                          <User className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Home className="w-5 h-5 text-purple-600" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-semibold text-gray-900 truncate">
                            {name}
                          </p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            doc.status === 'approved' ? 'bg-green-100 text-green-800' :
                            doc.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {doc.status === 'approved' ? 'Approuvé' :
                             doc.status === 'rejected' ? 'Refusé' : 'En attente'}
                          </span>
                        </div>

                        <p className="text-sm text-gray-600 mb-1">
                          {DOCUMENT_TYPE_LABELS[doc.document_type]}
                        </p>

                        <p className="text-xs text-gray-500">
                          {new Date(doc.uploaded_at).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>

                        {doc.admin_notes && (
                          <p className="text-xs text-gray-500 mt-1 italic">
                            Note: {doc.admin_notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Détails du document */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {selectedDocument ? (
            <>
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">Détails du document</h3>
              </div>

              <div className="p-6 space-y-6">
                {/* Info utilisateur */}
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-semibold text-gray-600">Utilisateur</label>
                    <p className="text-gray-900">
                      {selectedDocument.type === 'student'
                        ? (selectedDocument as StudentDocument).student_name
                        : (selectedDocument as LandlordDocument).landlord_name}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-600">Email</label>
                    <p className="text-gray-900">
                      {selectedDocument.type === 'student'
                        ? (selectedDocument as StudentDocument).student_email
                        : (selectedDocument as LandlordDocument).landlord_email}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-600">Type</label>
                    <p className="text-gray-900">
                      {selectedDocument.type === 'student' ? 'Étudiant' : 'Propriétaire'}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-600">Document</label>
                    <p className="text-gray-900">
                      {DOCUMENT_TYPE_LABELS[selectedDocument.document_type]}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-600">Statut actuel</label>
                    <span className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-bold ${
                      selectedDocument.status === 'approved' ? 'bg-green-100 text-green-800' :
                      selectedDocument.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {selectedDocument.status === 'approved' ? 'Approuvé' :
                       selectedDocument.status === 'rejected' ? 'Refusé' : 'En attente'}
                    </span>
                  </div>
                </div>

                {/* Aperçu du document */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-gray-600">Document</label>
                    <div className="flex gap-2">
                      <a
                        href={selectedDocumentUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        onClick={(e) => {
                          if (!selectedDocumentUrl) e.preventDefault();
                        }}
                      >
                        <Eye className="w-4 h-4" />
                        Ouvrir
                      </a>
                      <a
                        href={selectedDocumentUrl || '#'}
                        download={selectedDocument.file_name}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        onClick={(e) => {
                          if (!selectedDocumentUrl) e.preventDefault();
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Télécharger
                      </a>
                    </div>
                  </div>

                  {selectedDocumentUrl ? (
                    (selectedDocument.file_url.toLowerCase().endsWith('.pdf') || selectedDocument.file_name?.toLowerCase().endsWith('.pdf')) ? (
                      <div className="relative w-full h-96 bg-gray-100 rounded-lg border border-gray-200 overflow-hidden">
                        <iframe
                          src={`${selectedDocumentUrl}#toolbar=0`}
                          className="w-full h-full"
                          title="Aperçu du document"
                        />
                      </div>
                    ) : (
                      <div className="relative group">
                        <img
                          src={selectedDocumentUrl}
                          alt="Document"
                          className="w-full rounded-lg border border-gray-200"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            const parent = (e.target as HTMLImageElement).parentElement;
                            if (parent) {
                              parent.innerHTML = `
                                <div class="flex flex-col items-center justify-center h-48 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                                  <svg class="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                                  </svg>
                                  <p class="text-gray-500 text-sm">Impossible d'afficher l'aperçu</p>
                                  <p class="text-gray-400 text-xs mt-1">Cliquez sur "Ouvrir" pour voir le document</p>
                                </div>
                              `;
                            }
                          }}
                        />
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500 mb-2"></div>
                      <p className="text-gray-500 text-sm">Chargement du document...</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {selectedDocument.status === 'pending' && (
                  <div className="space-y-4 pt-4 border-t border-gray-200">
                    <div>
                      <label className="text-sm font-semibold text-gray-600 mb-2 block">
                        Raison du rejet (si refusé)
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Expliquez pourquoi le document est refusé..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApprove(selectedDocument)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                      >
                        <CheckCircle className="w-5 h-5" />
                        Approuver
                      </button>
                      <button
                        onClick={() => handleReject(selectedDocument)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
                      >
                        <XCircle className="w-5 h-5" />
                        Refuser
                      </button>
                    </div>
                  </div>
                )}

                {selectedDocument.status !== 'pending' && selectedDocument.admin_notes && (
                  <div className="pt-4 border-t border-gray-200">
                    <label className="text-sm font-semibold text-gray-600 mb-2 block">
                      Note de l'administrateur
                    </label>
                    <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                      {selectedDocument.admin_notes}
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full min-h-[400px]">
              <div className="text-center">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">Sélectionnez un document</p>
                <p className="text-gray-400 text-sm mt-2">
                  Choisissez un document pour le consulter et le vérifier
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
