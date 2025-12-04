import { CheckCircle, Clock, XCircle, AlertCircle, FileText, Camera } from 'lucide-react';

type VerificationStatusProps = {
  status: 'not_submitted' | 'pending' | 'approved' | 'rejected';
  submittedAt?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  language: 'fr' | 'en';
  hasAvatar: boolean;
  hasDocument: boolean;
};

export default function VerificationStatusCard({
  status,
  submittedAt,
  reviewedAt,
  rejectionReason,
  language,
  hasAvatar,
  hasDocument,
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

  const steps = [
    {
      id: 1,
      label: language === 'fr' ? 'Documents requis' : 'Required documents',
      status: hasAvatar && hasDocument ? 'completed' : status === 'not_submitted' ? 'current' : 'pending',
    },
    {
      id: 2,
      label: language === 'fr' ? 'En cours de vérification' : 'Verification in progress',
      status: status === 'pending' ? 'current' : status === 'approved' || status === 'rejected' ? 'completed' : 'pending',
    },
    {
      id: 3,
      label: language === 'fr' ? 'Vérifié' : 'Verified',
      status: status === 'approved' ? 'completed' : status === 'rejected' ? 'rejected' : 'pending',
    },
  ];

  const getMainStatusCard = () => {
    switch (status) {
      case 'not_submitted':
        return (
          <div className="space-y-4">
            <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-8 shadow-lg border-2 border-rose-100 hover:shadow-xl transition-shadow duration-300">
              <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-rose-50 flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 sm:h-7 sm:w-7 text-rose-500" />
                  </div>
                </div>
                <div className="flex-1 w-full space-y-3 sm:space-y-4">
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1.5 sm:mb-2">
                      {language === 'fr' ? 'Finalisez votre profil' : 'Complete your profile'}
                    </h3>
                    <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                      {language === 'fr'
                        ? 'Pour réserver un logement et contacter les propriétaires, veuillez télécharger votre attestation de scolarité INSEAD et une photo de profil.'
                        : 'To book accommodation and contact landlords, please upload your INSEAD school certificate and a profile photo.'}
                    </p>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs sm:text-sm text-amber-900 font-medium">
                        {language === 'fr'
                          ? 'Votre compte doit être vérifié avant de pouvoir réserver un logement'
                          : 'Your account must be verified before you can book accommodation'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-1 sm:pt-2">
                    <div className={`flex-1 p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all ${hasAvatar ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
                        <Camera className={`h-8 w-8 sm:h-5 sm:w-5 ${hasAvatar ? 'text-green-600' : 'text-gray-400'}`} />
                        <div className="flex-1 text-center sm:text-left min-w-0">
                          <p className={`text-xs sm:text-sm font-medium ${hasAvatar ? 'text-green-900' : 'text-gray-600'}`}>
                            {language === 'fr' ? 'Photo de profil' : 'Profile photo'}
                          </p>
                        </div>
                        {hasAvatar && <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />}
                      </div>
                    </div>

                    <div className={`flex-1 p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 transition-all ${hasDocument ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
                        <FileText className={`h-8 w-8 sm:h-5 sm:w-5 ${hasDocument ? 'text-green-600' : 'text-gray-400'}`} />
                        <div className="flex-1 text-center sm:text-left min-w-0">
                          <p className={`text-xs sm:text-sm font-medium ${hasDocument ? 'text-green-900' : 'text-gray-600'}`}>
                            {language === 'fr' ? 'Attestation INSEAD' : 'INSEAD certificate'}
                          </p>
                        </div>
                        {hasDocument && <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'pending':
        return (
          <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-8 shadow-lg border-2 border-blue-100 hover:shadow-xl transition-shadow duration-300">
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-blue-50 flex items-center justify-center">
                  <Clock className="h-6 w-6 sm:h-7 sm:w-7 text-blue-500" />
                </div>
              </div>
              <div className="flex-1 w-full space-y-3 sm:space-y-4">
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1.5 sm:mb-2">
                    {language === 'fr' ? 'Vérification en cours' : 'Verification in progress'}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                    {language === 'fr'
                      ? 'Votre dossier est en cours de vérification par notre équipe. Vous recevrez une notification dès validation.'
                      : 'Your application is being verified by our team. You will receive a notification once validated.'}
                  </p>
                </div>

                {submittedAt && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                    <span>{language === 'fr' ? 'Soumis le' : 'Submitted on'} {formatDate(submittedAt)}</span>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs sm:text-sm text-blue-900 font-medium mb-0.5 sm:mb-1">
                        {language === 'fr' ? 'Délai de vérification : 24-48 heures' : 'Verification time: 24-48 hours'}
                      </p>
                      <p className="text-xs text-blue-700">
                        {language === 'fr' ? 'Vous pourrez réserver dès validation' : 'You can book once validated'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'approved':
        return (
          <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-8 shadow-lg border-2 border-green-100 hover:shadow-xl transition-shadow duration-300">
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-green-50 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 sm:h-7 sm:w-7 text-green-500" />
                </div>
              </div>
              <div className="flex-1 w-full space-y-3 sm:space-y-4">
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1.5 sm:mb-2">
                    {language === 'fr' ? 'Compte vérifié' : 'Account verified'}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                    {language === 'fr'
                      ? 'Votre compte est vérifié. Vous pouvez maintenant réserver des logements et contacter les propriétaires.'
                      : 'Your account is verified. You can now book accommodation and contact landlords.'}
                  </p>
                </div>

                {reviewedAt && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                    <span>{language === 'fr' ? 'Vérifié le' : 'Verified on'} {formatDate(reviewedAt)}</span>
                  </div>
                )}

                <div className="bg-green-50 border border-green-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
                    <p className="text-xs sm:text-sm text-green-900 font-medium">
                      {language === 'fr'
                        ? 'Accès complet à toutes les fonctionnalités'
                        : 'Full access to all features'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'rejected':
        return (
          <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-8 shadow-lg border-2 border-red-100 hover:shadow-xl transition-shadow duration-300">
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-red-50 flex items-center justify-center">
                  <XCircle className="h-6 w-6 sm:h-7 sm:w-7 text-red-500" />
                </div>
              </div>
              <div className="flex-1 w-full space-y-3 sm:space-y-4">
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1.5 sm:mb-2">
                    {language === 'fr' ? 'Vérification refusée' : 'Verification rejected'}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
                    {language === 'fr'
                      ? 'Votre dossier n\'a pas pu être vérifié. Veuillez soumettre un nouveau document conforme aux exigences.'
                      : 'Your application could not be verified. Please submit a new document that meets the requirements.'}
                  </p>
                </div>

                {reviewedAt && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                    <span>{language === 'fr' ? 'Révisé le' : 'Reviewed on'} {formatDate(reviewedAt)}</span>
                  </div>
                )}

                {rejectionReason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs sm:text-sm text-red-900 font-medium mb-0.5 sm:mb-1">
                          {language === 'fr' ? 'Raison du refus' : 'Rejection reason'}
                        </p>
                        <p className="text-xs sm:text-sm text-red-700">{rejectionReason}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-amber-50 border border-amber-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs sm:text-sm text-amber-900 font-medium">
                      {language === 'fr'
                        ? 'Veuillez télécharger un nouveau document pour réessayer'
                        : 'Please upload a new document to try again'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {getMainStatusCard()}

      <div className="bg-white rounded-2xl border-2 border-gray-100 p-6">
        <h4 className="text-lg font-bold text-gray-900 mb-6">
          {language === 'fr' ? 'Étapes de vérification' : 'Verification steps'}
        </h4>

        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex-shrink-0">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                    step.status === 'completed'
                      ? 'bg-green-500 text-white'
                      : step.status === 'rejected'
                      ? 'bg-red-500 text-white'
                      : step.status === 'current'
                      ? 'bg-rose-500 text-white ring-4 ring-rose-200'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step.status === 'completed' ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : step.status === 'rejected' ? (
                    <XCircle className="h-5 w-5" />
                  ) : (
                    step.id
                  )}
                </div>
              </div>

              {index < steps.length - 1 && (
                <div className="absolute left-5 mt-14 w-0.5 h-8 bg-gray-200" />
              )}

              <div className="ml-4 flex-1">
                <p
                  className={`font-semibold text-sm ${
                    step.status === 'completed' || step.status === 'current'
                      ? 'text-gray-900'
                      : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </p>
                {step.id === 1 && step.status === 'current' && (
                  <div className="mt-2 space-y-2">
                    <div className={`flex items-center text-xs ${hasAvatar ? 'text-green-600' : 'text-gray-500'}`}>
                      <Camera className="h-4 w-4 mr-2" />
                      <span>{language === 'fr' ? 'Photo de profil' : 'Profile photo'}</span>
                      {hasAvatar && <CheckCircle className="h-4 w-4 ml-2" />}
                    </div>
                    <div className={`flex items-center text-xs ${hasDocument ? 'text-green-600' : 'text-gray-500'}`}>
                      <FileText className="h-4 w-4 mr-2" />
                      <span>{language === 'fr' ? 'Attestation INSEAD' : 'INSEAD certificate'}</span>
                      {hasDocument && <CheckCircle className="h-4 w-4 ml-2" />}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
