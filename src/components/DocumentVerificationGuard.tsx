import { useNavigate } from 'react-router-dom';
import { FileText, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useDocumentVerification } from '../hooks/useDocumentVerification';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

interface DocumentVerificationGuardProps {
  children: React.ReactNode;
  action: 'booking' | 'payment';
}

export default function DocumentVerificationGuard({ children, action }: DocumentVerificationGuardProps) {
  const { profile } = useAuth();
  const status = useDocumentVerification();
  const navigate = useNavigate();
  const { language } = useLanguage();

  if (profile?.role !== 'student' || status.loading) {
    return <>{children}</>;
  }

  if (status.allDocsApproved) {
    return <>{children}</>;
  }

  const getTitle = () => {
    if (action === 'booking') {
      return language === 'fr' ? 'Documents requis pour réserver' : 'Documents required to book';
    }
    return language === 'fr' ? 'Documents requis pour le paiement' : 'Documents required for payment';
  };

  const getMessage = () => {
    if (!status.hasAllRequiredDocs) {
      return language === 'fr'
        ? 'Vous devez d\'abord soumettre tous les documents obligatoires avant de pouvoir effectuer une réservation.'
        : 'You must first submit all required documents before you can make a booking.';
    }
    if (status.pendingDocs > 0) {
      return language === 'fr'
        ? 'Vos documents sont en cours de vérification. Vous pourrez effectuer des réservations une fois qu\'ils seront approuvés.'
        : 'Your documents are being reviewed. You will be able to make bookings once they are approved.';
    }
    if (status.rejectedDocs > 0) {
      return language === 'fr'
        ? 'Certains de vos documents ont été rejetés. Veuillez les soumettre à nouveau pour pouvoir effectuer des réservations.'
        : 'Some of your documents have been rejected. Please resubmit them to be able to make bookings.';
    }
    return language === 'fr'
      ? 'Vos documents doivent être approuvés avant de pouvoir effectuer une réservation.'
      : 'Your documents must be approved before you can make a booking.';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl border border-gray-200">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FileText className="w-10 h-10 text-rose-600" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            {getTitle()}
          </h1>

          <p className="text-lg text-gray-600 mb-6">
            {getMessage()}
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-rose-50 rounded-2xl p-6 mb-8">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            {language === 'fr' ? 'État de vos documents' : 'Your documents status'}
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between bg-white/80 rounded-lg p-3">
              <span className="text-sm font-medium text-gray-700">
                {language === 'fr' ? 'Documents requis' : 'Required documents'}
              </span>
              <span className="text-sm font-bold text-gray-900">
                {status.approvedRequired} / {status.totalRequired}
              </span>
            </div>

            {status.pendingDocs > 0 && (
              <div className="flex items-center gap-2 bg-white/80 rounded-lg p-3">
                <Clock className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-gray-700">
                  {status.pendingDocs} {language === 'fr' ? 'en attente de vérification' : 'pending verification'}
                </span>
              </div>
            )}

            {status.rejectedDocs > 0 && (
              <div className="flex items-center gap-2 bg-white/80 rounded-lg p-3">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-gray-700">
                  {status.rejectedDocs} {language === 'fr' ? 'rejetés' : 'rejected'}
                </span>
              </div>
            )}

            {status.approvedRequired === status.totalRequired && (
              <div className="flex items-center gap-2 bg-green-50 rounded-lg p-3 border border-green-200">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-green-700">
                  {language === 'fr' ? 'Tous vos documents sont approuvés !' : 'All your documents are approved!'}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => navigate('/mes-documents')}
            className="w-full px-6 py-4 bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            {language === 'fr' ? '📄 Gérer mes documents' : '📄 Manage my documents'}
          </button>

          <button
            onClick={() => navigate(-1)}
            className="w-full px-6 py-4 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-semibold"
          >
            {language === 'fr' ? 'Retour' : 'Go back'}
          </button>
        </div>

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
          <p className="text-xs text-yellow-900">
            <strong>{language === 'fr' ? '💡 Astuce :' : '💡 Tip:'}</strong>{' '}
            {language === 'fr'
              ? 'La vérification de vos documents prend généralement 24-48h. Vous recevrez une notification une fois qu\'ils seront approuvés.'
              : 'Document verification usually takes 24-48 hours. You will receive a notification once they are approved.'}
          </p>
        </div>
      </div>
    </div>
  );
}
