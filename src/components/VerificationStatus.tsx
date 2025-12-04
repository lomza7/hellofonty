import { CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';

type VerificationStatusProps = {
  status: 'not_submitted' | 'pending' | 'approved' | 'rejected';
  submittedAt?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  language: 'fr' | 'en';
};

export default function VerificationStatus({
  status,
  submittedAt,
  reviewedAt,
  rejectionReason,
  language,
}: VerificationStatusProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'not_submitted':
        return {
          icon: <AlertCircle className="h-7 w-7 text-rose-600" />,
          bgColor: 'bg-rose-50',
          borderColor: 'border-rose-200',
          textColor: 'text-rose-900',
          subTextColor: 'text-rose-800',
          title: language === 'fr' ? 'Action requise : Vérification obligatoire' : 'Action required: Verification mandatory',
          description:
            language === 'fr'
              ? 'Pour accéder à toutes les fonctionnalités et contacter les propriétaires, vous devez télécharger votre attestation de scolarité INSEAD et une photo de profil.'
              : 'To access all features and contact landlords, you must upload your INSEAD school certificate and a profile photo.',
        };
      case 'pending':
        return {
          icon: <Clock className="h-7 w-7 text-yellow-600" />,
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-900',
          subTextColor: 'text-yellow-700',
          title: language === 'fr' ? 'Vérification en cours' : 'Verification in progress',
          description:
            language === 'fr'
              ? 'Votre document est en cours de vérification par notre équipe. Cela prend généralement 24-48h.'
              : 'Your document is being verified by our team. This usually takes 24-48 hours.',
        };
      case 'approved':
        return {
          icon: <CheckCircle className="h-7 w-7 text-green-600" />,
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-900',
          subTextColor: 'text-green-700',
          title: language === 'fr' ? 'Compte vérifié' : 'Account verified',
          description:
            language === 'fr'
              ? 'Vous avez accès à toutes les fonctionnalités de la plateforme'
              : 'You have access to all platform features',
        };
      case 'rejected':
        return {
          icon: <XCircle className="h-7 w-7 text-red-600" />,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-900',
          subTextColor: 'text-red-700',
          title: language === 'fr' ? 'Vérification refusée' : 'Verification rejected',
          description:
            language === 'fr'
              ? 'Votre demande de vérification a été refusée. Veuillez télécharger un nouveau document.'
              : 'Your verification request was rejected. Please upload a new document.',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`p-5 rounded-xl border-2 ${config.borderColor} ${config.bgColor}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
        <div className="flex-1">
          <h4 className={`text-base font-bold ${config.textColor} mb-1`}>{config.title}</h4>
          <p className={`text-sm ${config.subTextColor} mb-2`}>{config.description}</p>

          {submittedAt && (
            <p className={`text-xs ${config.subTextColor} mt-2`}>
              {language === 'fr' ? 'Soumis le' : 'Submitted on'} {formatDate(submittedAt)}
            </p>
          )}

          {reviewedAt && (
            <p className={`text-xs ${config.subTextColor}`}>
              {language === 'fr' ? 'Vérifié le' : 'Reviewed on'} {formatDate(reviewedAt)}
            </p>
          )}

          {rejectionReason && status === 'rejected' && (
            <div className="mt-3 p-3 bg-white rounded-lg border border-red-200">
              <p className="text-xs font-semibold text-red-900 mb-1">
                {language === 'fr' ? 'Raison du refus :' : 'Rejection reason:'}
              </p>
              <p className="text-sm text-red-800">{rejectionReason}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
