import { X, AlertTriangle, Shield, Ban, UserX, AlertCircle, Edit3 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

type BlockedMessageModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onModify: () => void;
  attemptsCount: number;
};

export default function BlockedMessageModal({ isOpen, onClose, onModify, attemptsCount }: BlockedMessageModalProps) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  const showWarningLevel = attemptsCount >= 3;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in">
        <div className={`${showWarningLevel ? 'bg-gradient-to-r from-red-600 to-red-700' : 'bg-gradient-to-r from-rose-600 to-rose-700'} p-6 rounded-t-2xl relative`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <div className={`${showWarningLevel ? 'bg-red-800' : 'bg-rose-800'} bg-opacity-50 p-4 rounded-full`}>
              <AlertTriangle className="w-12 h-12 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                {t('messages.blocked.title')}
              </h2>
              {showWarningLevel && (
                <p className="text-red-100 font-semibold">
                  ⚠️ {t('messages.blocked.attemptWarning').replace('{count}', attemptsCount.toString())}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-rose-50 border-l-4 border-rose-600 p-4 rounded-r-lg">
            <div className="flex items-start gap-3">
              <Ban className="w-6 h-6 text-rose-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-rose-900 mb-2">
                  {t('messages.blocked.why')}
                </h3>
                <p className="text-rose-800 text-sm">
                  {t('messages.blocked.whyText')}
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              {t('messages.blocked.risksTitle')}
            </h3>
            <div className="space-y-3">
              {[
                {
                  icon: <UserX className="w-5 h-5" />,
                  titleKey: 'messages.blocked.risk.ban',
                  descKey: 'messages.blocked.risk.banDesc',
                },
                {
                  icon: <AlertTriangle className="w-5 h-5" />,
                  titleKey: 'messages.blocked.risk.scams',
                  descKey: 'messages.blocked.risk.scamsDesc',
                },
                {
                  icon: <Ban className="w-5 h-5" />,
                  titleKey: 'messages.blocked.risk.noProtection',
                  descKey: 'messages.blocked.risk.noProtectionDesc',
                },
                {
                  icon: <Shield className="w-5 h-5" />,
                  titleKey: 'messages.blocked.risk.noSupport',
                  descKey: 'messages.blocked.risk.noSupportDesc',
                },
              ].map((risk, index) => (
                <div key={index} className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div className="text-red-600 flex-shrink-0 mt-0.5">
                    {risk.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 text-sm">
                      {t(risk.titleKey)}
                    </h4>
                    <p className="text-gray-600 text-xs mt-1">
                      {t(risk.descKey)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <Shield className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-green-900 mb-2">
                  ✅ {t('messages.blocked.afterPayment')}
                </h3>
                <p className="text-green-800 text-sm">
                  {t('messages.blocked.afterPaymentText')}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onModify}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              <Edit3 className="w-5 h-5" />
              {t('messages.blocked.modify')}
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-semibold"
            >
              {t('messages.blocked.understand')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
