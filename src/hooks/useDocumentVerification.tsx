import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface DocumentVerificationStatus {
  hasAllRequiredDocs: boolean;
  allDocsApproved: boolean;
  pendingDocs: number;
  rejectedDocs: number;
  loading: boolean;
  totalRequired: number;
  approvedRequired: number;
}

const REQUIRED_DOCUMENT_TYPES = [
  'id_card_front',
  'id_card_back',
  'accommodation_certificate'
];

export function useDocumentVerification() {
  const { user, profile } = useAuth();
  const [status, setStatus] = useState<DocumentVerificationStatus>({
    hasAllRequiredDocs: false,
    allDocsApproved: false,
    pendingDocs: 0,
    rejectedDocs: 0,
    loading: true,
    totalRequired: REQUIRED_DOCUMENT_TYPES.length,
    approvedRequired: 0,
  });

  useEffect(() => {
    if (!user || profile?.role !== 'student') {
      setStatus({
        hasAllRequiredDocs: true,
        allDocsApproved: true,
        pendingDocs: 0,
        rejectedDocs: 0,
        loading: false,
        totalRequired: 0,
        approvedRequired: 0,
      });
      return;
    }

    loadDocumentStatus();
  }, [user, profile]);

  const loadDocumentStatus = async () => {
    try {
      const { data: documents, error } = await supabase
        .from('student_documents')
        .select('document_type, status')
        .eq('student_id', user!.id);

      if (error) throw error;

      const requiredDocs = documents?.filter(doc =>
        REQUIRED_DOCUMENT_TYPES.includes(doc.document_type)
      ) || [];

      const approvedRequired = requiredDocs.filter(doc => doc.status === 'approved').length;
      const pendingDocs = documents?.filter(doc => doc.status === 'pending').length || 0;
      const rejectedDocs = documents?.filter(doc => doc.status === 'rejected').length || 0;

      const hasAllRequiredDocs = REQUIRED_DOCUMENT_TYPES.every(type =>
        documents?.some(doc => doc.document_type === type)
      );

      const allDocsApproved = REQUIRED_DOCUMENT_TYPES.every(type =>
        documents?.some(doc => doc.document_type === type && doc.status === 'approved')
      );

      setStatus({
        hasAllRequiredDocs,
        allDocsApproved,
        pendingDocs,
        rejectedDocs,
        loading: false,
        totalRequired: REQUIRED_DOCUMENT_TYPES.length,
        approvedRequired,
      });
    } catch (err: any) {
      console.error('Error loading document status:', err);
      setStatus({
        hasAllRequiredDocs: false,
        allDocsApproved: false,
        pendingDocs: 0,
        rejectedDocs: 0,
        loading: false,
        totalRequired: REQUIRED_DOCUMENT_TYPES.length,
        approvedRequired: 0,
      });
    }
  };

  return status;
}
