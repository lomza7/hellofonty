import { X, AlertTriangle, User, Calendar, MessageSquare, Eye } from 'lucide-react';
import { getDetectionTypeLabel, getDetectionTypeBadgeColor } from '../utils/messageDetection';
import { useLanguage } from '../contexts/LanguageContext';

type BlockedMessage = {
  id: string;
  user_id: string;
  recipient_id: string;
  blocked_content: string;
  detection_type: string;
  detected_patterns: string[];
  created_at: string;
  conversation_context?: string;
  user_name: string;
  recipient_name: string;
  user_email: string;
};

type BlockedMessageDetailsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  blockedMessage: BlockedMessage | null;
  userAttempts: number;
};

export default function BlockedMessageDetailsModal({
  isOpen,
  onClose,
  blockedMessage,
  userAttempts,
}: BlockedMessageDetailsModalProps) {
  const { t } = useLanguage();

  if (!isOpen || !blockedMessage) return null;

  const highlightPatterns = (text: string, patterns: string[]) => {
    let highlightedText = text;
    patterns.forEach((pattern) => {
      const regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      highlightedText = highlightedText.replace(
        regex,
        '<span class="bg-red-200 text-red-900 font-bold px-1 rounded">$&</span>'
      );
    });
    return highlightedText;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[calc(100vh-2rem)] overflow-y-auto shadow-2xl my-auto">
        <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 rounded-t-2xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <div className="bg-red-800 bg-opacity-50 p-4 rounded-full">
              <AlertTriangle className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">{t('admin.alerts.detailsTitle')}</h2>
              <p className="text-red-100">
                {userAttempts} {t('admin.alerts.totalAttempts30')}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-5 h-5 text-gray-600" />
                <h3 className="font-bold text-gray-900">{t('admin.alerts.user')}</h3>
              </div>
              <p className="text-sm text-gray-700 font-medium">{blockedMessage.user_name}</p>
              <p className="text-xs text-gray-500 mt-1">{blockedMessage.user_email}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-5 h-5 text-gray-600" />
                <h3 className="font-bold text-gray-900">{t('admin.alerts.recipient')}</h3>
              </div>
              <p className="text-sm text-gray-700 font-medium">{blockedMessage.recipient_name}</p>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-600" />
                <h3 className="font-bold text-gray-900">{t('admin.alerts.dateType')}</h3>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${getDetectionTypeBadgeColor(
                  blockedMessage.detection_type as any
                )}`}
              >
                {getDetectionTypeLabel(blockedMessage.detection_type as any, 'fr')}
              </span>
            </div>
            <p className="text-sm text-gray-700">
              {new Date(blockedMessage.created_at).toLocaleString('fr-FR', {
                dateStyle: 'full',
                timeStyle: 'long',
              })}
            </p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-5 h-5 text-red-600" />
              <h3 className="font-bold text-red-900">{t('admin.alerts.blockedContent')}</h3>
            </div>
            <div
              className="bg-white p-4 rounded border border-red-300 text-sm text-gray-900 whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={{
                __html: highlightPatterns(blockedMessage.blocked_content, blockedMessage.detected_patterns),
              }}
            />
          </div>

          {blockedMessage.detected_patterns.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-5 h-5 text-yellow-600" />
                <h3 className="font-bold text-yellow-900">{t('admin.alerts.detectedPatterns')}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {blockedMessage.detected_patterns.map((pattern, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-yellow-100 text-yellow-900 rounded-full text-xs font-mono border border-yellow-300"
                  >
                    {pattern}
                  </span>
                ))}
              </div>
            </div>
          )}

          {userAttempts >= 3 && (
            <div className="bg-orange-50 border-l-4 border-orange-600 p-4 rounded-r-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-orange-900 mb-1">⚠️ {t('admin.alerts.userAtRiskTitle')}</h3>
                  <p className="text-orange-800 text-sm">
                    {t('admin.alerts.userAtRiskDesc').replace('{count}', userAttempts.toString())}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-semibold"
            >
              {t('admin.alerts.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
