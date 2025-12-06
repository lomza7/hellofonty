import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useDocumentNotifications } from '../hooks/useDocumentNotifications';
import { useLanguage } from '../contexts/LanguageContext';

const documentTypeLabels: { [key: string]: { fr: string; en: string } } = {
  'id_card_front': { fr: 'Pièce d\'identité (Recto)', en: 'ID Card (Front)' },
  'id_card_back': { fr: 'Pièce d\'identité (Verso)', en: 'ID Card (Back)' },
  'accommodation_certificate': { fr: 'Attestation d\'hébergement', en: 'Accommodation Certificate' },
  'insurance_certificate': { fr: 'Attestation d\'assurance', en: 'Home Insurance Certificate' },
  'lease_copy': { fr: 'Copie du bail', en: 'Lease Copy' },
  'inventory_copy': { fr: 'État des lieux', en: 'Inventory' },
};

export default function DocumentNotificationToast() {
  const { notification } = useDocumentNotifications();
  const { language } = useLanguage();

  if (!notification) return null;

  const getDocLabel = (type: string) => {
    return documentTypeLabels[type]?.[language] || type;
  };

  const getIcon = () => {
    switch (notification.status) {
      case 'approved':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-6 h-6 text-red-500" />;
      case 'needs_correction':
        return <AlertCircle className="w-6 h-6 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (notification.status) {
      case 'approved':
        return language === 'fr' ? 'Document approuvé !' : 'Document approved!';
      case 'rejected':
        return language === 'fr' ? 'Document rejeté' : 'Document rejected';
      case 'needs_correction':
        return language === 'fr' ? 'Document à corriger' : 'Document needs correction';
      default:
        return '';
    }
  };

  const getBgColor = () => {
    switch (notification.status) {
      case 'approved':
        return 'bg-green-50 border-green-200';
      case 'rejected':
        return 'bg-red-50 border-red-200';
      case 'needs_correction':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className={`max-w-sm rounded-xl shadow-2xl border-2 p-4 ${getBgColor()}`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 mb-1">
              {getTitle()}
            </p>
            <p className="text-sm text-gray-700 mb-2">
              {getDocLabel(notification.document_type)}
            </p>
            {notification.admin_notes && (
              <p className="text-xs text-gray-600 bg-white/60 rounded-lg p-2 mt-2">
                <strong>
                  {language === 'fr' ? 'Note :' : 'Note:'}
                </strong>{' '}
                {notification.admin_notes}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
