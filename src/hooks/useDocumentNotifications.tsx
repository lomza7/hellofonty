import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface DocumentNotification {
  id: string;
  document_type: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_correction';
  admin_notes?: string;
}

export function useDocumentNotifications() {
  const { user } = useAuth();
  const [notification, setNotification] = useState<DocumentNotification | null>(null);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('document-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'student_documents',
          filter: `student_id=eq.${user.id}`,
        },
        (payload) => {
          const newDoc = payload.new as DocumentNotification;

          if (newDoc.status === 'approved' || newDoc.status === 'rejected' || newDoc.status === 'needs_correction') {
            setNotification(newDoc);

            setTimeout(() => {
              setNotification(null);
            }, 8000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { notification };
}
