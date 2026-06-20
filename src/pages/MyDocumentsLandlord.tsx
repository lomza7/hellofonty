import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, CheckCircle, Clock, XCircle, Download, Trash2, AlertCircle, Building2, Home } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import BackButton from '../components/BackButton';

type Document = {
  id: string;
  document_type: string;
  file_url: string;
  file_name: string;
  listing_id?: string;
  tenant_id?: string;
  uploaded_at: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string;
};

type Listing = {
  id: string;
  title: string;
  address: string;
};

type TenantInsurance = Document & {
  tenant_name?: string;
  listing_title?: string;
};

type DocumentType = {
  id: string;
  labelFr: string;
  labelEn: string;
  descriptionFr: string;
  descriptionEn: string;
  required: boolean;
  acceptedFormats: string;
  category: 'verification' | 'signed';
};

export default function MyDocumentsLandlord() {
  const { profile, user } = useAuth();
  const { language } = useLanguage();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [tenantInsurances, setTenantInsurances] = useState<TenantInsurance[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedListing, setSelectedListing] = useState<string>('');
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const documentTypes: DocumentType[] = [
    {
      id: 'id_card',
      labelFr: 'Pièce d\'identité',
      labelEn: 'ID Card',
      descriptionFr: 'Carte d\'identité ou passeport (personne physique)',
      descriptionEn: 'ID card or passport (individual)',
      required: true,
      acceptedFormats: 'PDF, JPG, PNG (max 5MB)',
      category: 'verification',
    },
    {
      id: 'kbis',
      labelFr: 'Extrait Kbis',
      labelEn: 'Kbis Extract',
      descriptionFr: 'Extrait Kbis de moins de 3 mois (personne morale)',
      descriptionEn: 'Kbis extract less than 3 months old (legal entity)',
      required: false,
      acceptedFormats: 'PDF (max 5MB)',
      category: 'verification',
    },
    {
      id: 'property_tax',
      labelFr: 'Taxe foncière',
      labelEn: 'Property Tax',
      descriptionFr: 'Avis de taxe foncière pour prouver la propriété',
      descriptionEn: 'Property tax notice to prove ownership',
      required: true,
      acceptedFormats: 'PDF (max 5MB)',
      category: 'verification',
    },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [docsResult, listingsResult, insuranceResult] = await Promise.all([
        supabase
          .from('landlord_documents')
          .select('*')
          .eq('landlord_id', user.id)
          .order('uploaded_at', { ascending: false }),
        supabase
          .from('listings')
          .select('id, title, address')
          .eq('landlord_id', user.id),
        supabase
          .from('student_documents')
          .select(`
            id,
            document_type,
            file_url,
            file_name,
            uploaded_at,
            status,
            student_id,
            booking_id,
            bookings!inner(
              listing_id,
              student_id,
              listings!inner(
                landlord_id,
                title,
                address
              )
            ),
            profiles!student_documents_student_id_fkey(
              first_name,
              last_name
            )
          `)
          .eq('document_type', 'insurance_certificate')
          .eq('bookings.listings.landlord_id', user.id)
      ]);

      if (docsResult.error) throw docsResult.error;
      if (listingsResult.error) throw listingsResult.error;

      setDocuments(docsResult.data || []);
      setListings(listingsResult.data || []);

      if (!insuranceResult.error && insuranceResult.data) {
        const formattedInsurances = insuranceResult.data.map((doc: any) => ({
          id: doc.id,
          document_type: doc.document_type,
          file_url: doc.file_url,
          file_name: doc.file_name,
          uploaded_at: doc.uploaded_at,
          status: doc.status,
          tenant_id: doc.student_id,
          tenant_name: doc.profiles
            ? `${doc.profiles.first_name} ${doc.profiles.last_name}`
            : 'Inconnu',
          listing_title: doc.bookings?.listings?.title || 'Logement inconnu',
        }));
        setTenantInsurances(formattedInsurances);
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (documentType: string, event: React.ChangeEvent<HTMLInputElement>, listingId?: string) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Le fichier ne doit pas dépasser 5MB');
      return;
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setError('Format de fichier non accepté. Utilisez PDF, JPG ou PNG');
      return;
    }

    setError('');
    setSuccess('');
    setUploading(documentType + (listingId || ''));

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${documentType}${listingId ? `_${listingId}` : ''}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('landlord-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const fileUrl = fileName;

      const existingDoc = documents.find(d =>
        d.document_type === documentType &&
        (listingId ? d.listing_id === listingId : !d.listing_id)
      );

      if (existingDoc) {
        const oldFileName = existingDoc.file_url.split('/').pop();
        if (oldFileName) {
          await supabase.storage
            .from('landlord-documents')
            .remove([`${user.id}/${oldFileName}`]);
        }

        const { error: updateError } = await supabase
          .from('landlord_documents')
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
          .from('landlord_documents')
          .insert({
            landlord_id: user.id,
            document_type: documentType,
            file_url: fileUrl,
            file_name: file.name,
            listing_id: listingId || null,
            status: 'pending',
          });

        if (insertError) throw insertError;
      }

      setSuccess('Document uploadé avec succès !');
      await loadData();
    } catch (err: any) {
      console.error('Upload error:', err);
      setError('Erreur lors de l\'upload : ' + err.message);
    } finally {
      setUploading(null);
      const inputKey = documentType + (listingId || '');
      if (fileInputRefs.current[inputKey]) {
        fileInputRefs.current[inputKey]!.value = '';
      }
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;

    try {
      const fileName = doc.file_url.split('/').pop();
      if (fileName && user) {
        await supabase.storage
          .from('landlord-documents')
          .remove([`${user.id}/${fileName}`]);
      }

      const { error } = await supabase
        .from('landlord_documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;

      setSuccess('Document supprimé avec succès');
      await loadData();
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

  const getSignedUrl = async (filePath: string, isStudentDoc = false): Promise<string> => {
    const bucketName = isStudentDoc ? 'student-documents' : 'landlord-documents';
    const cleanPath = extractFilePath(filePath, bucketName);
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(cleanPath, 3600);

    if (error) throw error;
    return data.signedUrl;
  };

  const handleDownload = async (fileUrl: string, fileName: string, isStudentDoc = false) => {
    try {
      const signedUrl = await getSignedUrl(fileUrl, isStudentDoc);
      const response = await fetch(signedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Erreur lors du téléchargement');
    }
  };

  const getDocumentByType = (type: string, listingId?: string) => {
    return documents.find(d =>
      d.document_type === type &&
      (listingId ? d.listing_id === listingId : !d.listing_id)
    );
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

  const verificationDocs = documentTypes.filter(d => d.category === 'verification');

  if (profile?.role !== 'landlord') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 text-center shadow-xl">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Accès réservé aux propriétaires
          </h2>
          <p className="text-gray-600">
            Cette page est uniquement accessible aux comptes propriétaires.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <BackButton />
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {language === 'fr' ? 'Mes documents' : 'My Documents'}
          </h1>
          <p className="text-gray-600">
            {language === 'fr'
              ? 'Gérez tous vos documents de propriétaire'
              : 'Manage all your landlord documents'}
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
              <div className="bg-blue-100 p-3 rounded-xl">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {language === 'fr' ? 'Documents de vérification' : 'Verification Documents'}
                </h2>
                <p className="text-sm text-gray-600">
                  {language === 'fr'
                    ? 'Documents requis pour la vérification de votre compte'
                    : 'Documents required for account verification'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {verificationDocs.map((docType) => {
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
                            onClick={() => handleDownload(doc.file_url, doc.file_name)}
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
                          accept=".pdf,.jpg,.jpeg,.png"
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
                  {language === 'fr' ? 'Documents signés par logement' : 'Signed Documents by Property'}
                </h2>
                <p className="text-sm text-gray-600">
                  {language === 'fr'
                    ? 'Baux et états des lieux signés pour chaque logement'
                    : 'Signed leases and inventories for each property'}
                </p>
              </div>
            </div>

            {listings.length === 0 ? (
              <div className="text-center py-8">
                <Home className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">
                  {language === 'fr'
                    ? 'Vous n\'avez pas encore de logement publié'
                    : 'You don\'t have any published properties yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {language === 'fr' ? 'Sélectionner un logement :' : 'Select a property:'}
                  </label>
                  <select
                    value={selectedListing}
                    onChange={(e) => setSelectedListing(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">
                      {language === 'fr' ? '-- Choisir un logement --' : '-- Choose a property --'}
                    </option>
                    {listings.map((listing) => (
                      <option key={listing.id} value={listing.id}>
                        {listing.title} - {listing.address}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedListing && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {['lease_copy', 'inventory_copy'].map((docType) => {
                      const doc = getDocumentByType(docType, selectedListing);
                      const isLease = docType === 'lease_copy';
                      const label = isLease
                        ? (language === 'fr' ? 'Bail signé' : 'Signed Lease')
                        : (language === 'fr' ? 'État des lieux' : 'Inventory');

                      return (
                        <div
                          key={docType}
                          className="border-2 border-gray-200 rounded-xl p-5"
                        >
                          <h3 className="font-bold text-gray-900 mb-3">{label}</h3>

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

                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleDownload(doc.file_url, doc.file_name)}
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
                                ref={(el) => fileInputRefs.current[docType + selectedListing] = el}
                                type="file"
                                accept=".pdf"
                                onChange={(e) => handleFileSelect(docType, e, selectedListing)}
                                className="hidden"
                              />
                              <button
                                onClick={() => fileInputRefs.current[docType + selectedListing]?.click()}
                                disabled={uploading === docType + selectedListing}
                                className="w-full px-4 py-2 border-2 border-green-300 text-green-600 rounded-lg hover:bg-green-50 transition text-sm font-semibold disabled:opacity-50"
                              >
                                {uploading === docType + selectedListing
                                  ? (language === 'fr' ? 'Upload...' : 'Uploading...')
                                  : (language === 'fr' ? 'Remplacer' : 'Replace')}
                              </button>
                            </div>
                          ) : (
                            <div>
                              <input
                                ref={(el) => fileInputRefs.current[docType + selectedListing] = el}
                                type="file"
                                accept=".pdf"
                                onChange={(e) => handleFileSelect(docType, e, selectedListing)}
                                className="hidden"
                              />
                              <button
                                onClick={() => fileInputRefs.current[docType + selectedListing]?.click()}
                                disabled={uploading === docType + selectedListing}
                                className="w-full px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                <Upload className="w-5 h-5" />
                                {uploading === docType + selectedListing
                                  ? (language === 'fr' ? 'Upload en cours...' : 'Uploading...')
                                  : (language === 'fr' ? 'Uploader' : 'Upload')}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-purple-100 p-3 rounded-xl">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {language === 'fr' ? 'Assurances habitation des locataires' : 'Tenant Home Insurance'}
                </h2>
                <p className="text-sm text-gray-600">
                  {language === 'fr'
                    ? 'Attestations d\'assurance fournies par vos locataires'
                    : 'Insurance certificates provided by your tenants'}
                </p>
              </div>
            </div>

            {tenantInsurances.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">
                  {language === 'fr'
                    ? 'Aucune assurance de locataire disponible pour le moment'
                    : 'No tenant insurance available at the moment'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {tenantInsurances.map((insurance) => (
                  <div
                    key={insurance.id}
                    className="border-2 border-purple-200 rounded-xl p-5"
                  >
                    <div className="mb-3">
                      <h3 className="font-bold text-gray-900">{insurance.tenant_name}</h3>
                      <p className="text-sm text-gray-600">{insurance.listing_title}</p>
                    </div>

                    <div className="bg-purple-50 rounded-lg p-3 border border-purple-200 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-900 truncate flex-1">
                          {insurance.file_name}
                        </p>
                        {getStatusIcon(insurance.status)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          insurance.status === 'approved' ? 'bg-green-100 text-green-700' :
                          insurance.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {getStatusText(insurance.status)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(insurance.uploaded_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDownload(insurance.file_url, insurance.file_name, true)}
                      className="w-full px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition font-semibold flex items-center justify-center gap-2"
                    >
                      <Download className="w-5 h-5" />
                      {language === 'fr' ? 'Télécharger' : 'Download'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
