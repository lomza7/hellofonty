import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, CheckCircle, XCircle, Clock, AlertCircle, Download, Eye, User, Mail, Phone } from 'lucide-react';

interface StudentDocument {
  id: string;
  student_id: string;
  document_type: string;
  file_url: string;
  file_name: string;
  uploaded_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_correction';
  admin_notes?: string;
  student?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  };
}

interface StudentWithDocuments {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  documents: StudentDocument[];
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

export default function DocumentsAdmin() {
  const [students, setStudents] = useState<StudentWithDocuments[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithDocuments | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<StudentDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminNote, setAdminNote] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const { data: documents, error } = await supabase
        .from('student_documents')
        .select(`
          *,
          student:profiles!student_documents_student_id_fkey(id, first_name, last_name, email, phone)
        `)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      const studentsMap = new Map<string, StudentWithDocuments>();

      documents?.forEach((doc: any) => {
        if (!doc.student) return;

        const studentId = doc.student.id;

        if (!studentsMap.has(studentId)) {
          studentsMap.set(studentId, {
            id: studentId,
            first_name: doc.student.first_name,
            last_name: doc.student.last_name,
            email: doc.student.email,
            phone: doc.student.phone,
            documents: [],
            pendingCount: 0,
            approvedCount: 0,
            rejectedCount: 0,
          });
        }

        const student = studentsMap.get(studentId)!;
        const docData = {
          ...doc,
          student: doc.student,
        };
        student.documents.push(docData);

        if (doc.status === 'pending') student.pendingCount++;
        else if (doc.status === 'approved') student.approvedCount++;
        else if (doc.status === 'rejected') student.rejectedCount++;
      });

      const studentsArray = Array.from(studentsMap.values());
      studentsArray.sort((a, b) => b.pendingCount - a.pendingCount);

      setStudents(studentsArray);
    } catch (err: any) {
      console.error('Error loading documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateDocumentStatus = async (
    documentId: string,
    status: 'approved' | 'rejected' | 'needs_correction',
    note?: string
  ) => {
    setUpdating(true);
    try {
      const { error: updateError } = await supabase
        .from('student_documents')
        .update({
          status,
          admin_notes: note || null,
        })
        .eq('id', documentId);

      if (updateError) throw updateError;

      if (selectedDocument) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-document-status-update`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              studentId: selectedDocument.student_id,
              documentType: selectedDocument.document_type,
              status,
              adminNote: note,
            }),
          });
        }
      }

      await loadDocuments();
      setSelectedDocument(null);
      setAdminNote('');
      alert('Statut mis à jour avec succès !');
    } catch (err: any) {
      console.error('Error updating document:', err);
      alert('Erreur lors de la mise à jour');
    } finally {
      setUpdating(false);
    }
  };

  const getDocumentTypeLabel = (type: string): string => {
    const labels: { [key: string]: string } = {
      'id_card_front': 'Pièce d\'identité (Recto)',
      'id_card_back': 'Pièce d\'identité (Verso)',
      'accommodation_certificate': 'Attestation d\'hébergement',
      'insurance_certificate': 'Attestation d\'assurance',
      'lease_copy': 'Copie du bail',
      'inventory_copy': 'État des lieux',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            Approuvé
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
            <Clock className="w-3 h-3" />
            En attente
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
            <XCircle className="w-3 h-3" />
            Rejeté
          </span>
        );
      case 'needs_correction':
        return (
          <span className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
            <AlertCircle className="w-3 h-3" />
            À corriger
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Étudiants avec documents</h2>
          <p className="text-sm text-gray-500 mt-1">
            {students.length} étudiant(s) • {students.reduce((sum, s) => sum + s.pendingCount, 0)} en attente
          </p>
        </div>

        <div className="divide-y divide-gray-200 max-h-[700px] overflow-y-auto">
          {students.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Aucun document soumis</p>
            </div>
          ) : (
            students.map((student) => (
              <button
                key={student.id}
                onClick={() => {
                  setSelectedStudent(student);
                  setSelectedDocument(null);
                }}
                className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                  selectedStudent?.id === student.id ? 'bg-rose-50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {student.first_name.charAt(0)}{student.last_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">
                        {student.first_name} {student.last_name}
                      </p>
                      <p className="text-sm text-gray-500 truncate">{student.email}</p>
                      {student.phone && (
                        <p className="text-xs text-gray-400 mt-1">{student.phone}</p>
                      )}
                      <div className="flex gap-2 mt-2">
                        {student.pendingCount > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">
                            {student.pendingCount} en attente
                          </span>
                        )}
                        {student.approvedCount > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                            {student.approvedCount} approuvés
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Eye className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {selectedStudent ? (
          <>
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center text-white font-bold text-xl">
                  {selectedStudent.first_name.charAt(0)}{selectedStudent.last_name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    {selectedStudent.email}
                  </div>
                  {selectedStudent.phone && (
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                      <Phone className="w-4 h-4" />
                      {selectedStudent.phone}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
              {selectedStudent.documents.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Aucun document</p>
                </div>
              ) : (
                selectedStudent.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                      selectedDocument?.id === doc.id
                        ? 'border-rose-500 bg-rose-50'
                        : 'border-gray-200 hover:border-rose-300'
                    }`}
                    onClick={() => setSelectedDocument(doc)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 mb-1">
                          {getDocumentTypeLabel(doc.document_type)}
                        </h3>
                        <p className="text-xs text-gray-500 mb-2">{doc.file_name}</p>
                        <p className="text-xs text-gray-400">
                          Uploadé le {new Date(doc.uploaded_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      {getStatusBadge(doc.status)}
                    </div>

                    {doc.admin_notes && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                        <p className="text-xs font-semibold text-yellow-900 mb-1">Note admin :</p>
                        <p className="text-xs text-yellow-800">{doc.admin_notes}</p>
                      </div>
                    )}

                    {selectedDocument?.id === doc.id && (
                      <div className="space-y-3 pt-3 border-t border-gray-200">
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-semibold"
                        >
                          <Eye className="w-4 h-4" />
                          Voir le document
                        </a>

                        <a
                          href={doc.file_url}
                          download={doc.file_name}
                          className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-semibold"
                        >
                          <Download className="w-4 h-4" />
                          Télécharger
                        </a>

                        <textarea
                          value={adminNote}
                          onChange={(e) => setAdminNote(e.target.value)}
                          placeholder="Note pour l'étudiant (optionnel)"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent text-sm"
                          rows={3}
                        />

                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => updateDocumentStatus(doc.id, 'approved', adminNote)}
                            disabled={updating}
                            className="flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-semibold disabled:opacity-50"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Approuver
                          </button>
                          <button
                            onClick={() => updateDocumentStatus(doc.id, 'needs_correction', adminNote)}
                            disabled={updating}
                            className="flex items-center justify-center gap-1 px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition text-sm font-semibold disabled:opacity-50"
                          >
                            <AlertCircle className="w-4 h-4" />
                            Corriger
                          </button>
                          <button
                            onClick={() => updateDocumentStatus(doc.id, 'rejected', adminNote)}
                            disabled={updating}
                            className="flex items-center justify-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            Rejeter
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="p-12 text-center">
            <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Sélectionnez un étudiant pour voir ses documents</p>
          </div>
        )}
      </div>
    </div>
  );
}
