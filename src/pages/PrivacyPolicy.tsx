import { useLanguage } from '../contexts/LanguageContext';
import SEO from '../components/SEO';
import BackButton from '../components/BackButton';

export default function PrivacyPolicy() {
  const { language } = useLanguage();

  return (
    <>
      <SEO
        title={language === 'fr' ? 'Politique de confidentialité (RGPD)' : 'Privacy Policy (GDPR)'}
        description={language === 'fr' ? 'Politique de confidentialité et protection des données de Hellofonty' : 'Hellofonty privacy policy and data protection'}
      />

      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <BackButton />
          <div className="bg-white rounded-2xl shadow-sm p-8">
            {language === 'fr' ? (
              <>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                  Politique de confidentialité (RGPD)
                </h1>
                <p className="text-gray-700 mb-8">
                  <strong>Responsable de traitement :</strong> SAS HELLOFONTY<br />
                  <strong>Contact RGPD :</strong>{' '}
                  <a href="mailto:support@hellofonty.fr" className="text-rose-600 hover:text-rose-700">
                    support@hellofonty.fr
                  </a>
                </p>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Données traitées</h2>
                  <ul className="list-disc pl-6 text-gray-700">
                    <li><strong>identité et contact :</strong> nom, prénom, email ;</li>
                    <li><strong>vérification INSEAD :</strong> attestation de scolarité (locataires) ;</li>
                    <li><strong>compte et profil :</strong> informations de compte ;</li>
                    <li><strong>annonces :</strong> informations logement, photos, disponibilités ;</li>
                    <li><strong>messagerie :</strong> contenu et métadonnées ;</li>
                    <li><strong>réservations :</strong> dates, montants, statuts ;</li>
                    <li><strong>paiements :</strong> identifiants de transaction, statuts ;</li>
                    <li><strong>données techniques :</strong> logs, IP, cookies.</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Finalités et bases légales</h2>
                  <ul className="list-disc pl-6 text-gray-700">
                    <li>fourniture des Services (exécution du contrat) ;</li>
                    <li>vérification éligibilité INSEAD (intérêt légitime / mesures précontractuelles) ;</li>
                    <li>facturation/comptabilité (obligation légale) ;</li>
                    <li>sécurité, prévention fraude/abus, modération (intérêt légitime) ;</li>
                    <li>audience via Google Analytics 4 (GA4) (consentement) ;</li>
                    <li>support (contrat / intérêt légitime).</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Destinataires</h2>
                  <ul className="list-disc pl-6 text-gray-700">
                    <li>équipes internes habilitées ;</li>
                    <li>prestataires techniques (hébergement OVHcloud, outils d'exploitation) ;</li>
                    <li>Stripe (paiements et Stripe Connect) ;</li>
                    <li>Google (GA4) lorsque activé après consentement.</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Transferts hors UE</h2>
                  <p className="text-gray-700">
                    Certains prestataires peuvent impliquer des transferts hors EEE. Dans ce cas, Hellofonty
                    met en place des garanties appropriées (notamment clauses contractuelles types).
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Conservation</h2>
                  <p className="text-gray-700 mb-4">
                    Hellofonty conserve les données pendant la durée nécessaire aux finalités, puis les supprime
                    ou les archive de manière limitée pour respecter ses obligations légales (comptabilité, preuve,
                    contentieux).
                  </p>
                  <p className="text-gray-700">
                    L'attestation INSEAD est conservée le temps strictement nécessaire à la vérification et à la
                    prévention de fraude, puis supprimée/archivée en accès restreint si nécessaire.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Sécurité</h2>
                  <p className="text-gray-700">
                    Mesures raisonnables de sécurité : contrôle d'accès, chiffrement en transit, journalisation,
                    restriction d'accès aux justificatifs.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Vos droits</h2>
                  <p className="text-gray-700 mb-4">
                    Accès, rectification, effacement, limitation, opposition, portabilité (selon conditions).
                  </p>
                  <p className="text-gray-700">
                    <strong>Exercice :</strong>{' '}
                    <a href="mailto:support@hellofonty.fr" className="text-rose-600 hover:text-rose-700">
                      support@hellofonty.fr
                    </a>
                    <br />
                    <strong>Réclamation :</strong> CNIL
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Politique Cookies</h2>
                  <p className="text-gray-700 mb-4">Le Site utilise :</p>
                  <ul className="list-disc pl-6 text-gray-700 mb-4">
                    <li>des cookies nécessaires (authentification, sécurité, session) ;</li>
                    <li>des cookies de mesure d'audience via GA4 (soumis au consentement) ;</li>
                    <li>d'autres cookies éventuels décrits dans le gestionnaire de cookies.</li>
                  </ul>
                  <p className="text-gray-700">
                    Lors de la première visite, un bandeau permet d'accepter/refuser les cookies non essentiels.
                    Vous pouvez modifier votre choix à tout moment via le gestionnaire de cookies.
                  </p>
                </section>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                  Privacy Policy (GDPR)
                </h1>
                <p className="text-gray-700 mb-8">
                  <strong>Data Controller:</strong> SAS HELLOFONTY<br />
                  <strong>GDPR Contact:</strong>{' '}
                  <a href="mailto:support@hellofonty.fr" className="text-rose-600 hover:text-rose-700">
                    support@hellofonty.fr
                  </a>
                </p>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Data Processed</h2>
                  <ul className="list-disc pl-6 text-gray-700">
                    <li><strong>identity and contact:</strong> name, first name, email;</li>
                    <li><strong>INSEAD verification:</strong> enrollment certificate (tenants);</li>
                    <li><strong>account and profile:</strong> account information;</li>
                    <li><strong>listings:</strong> housing information, photos, availability;</li>
                    <li><strong>messaging:</strong> content and metadata;</li>
                    <li><strong>bookings:</strong> dates, amounts, statuses;</li>
                    <li><strong>payments:</strong> transaction IDs, statuses;</li>
                    <li><strong>technical data:</strong> logs, IP, cookies.</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Purposes and Legal Bases</h2>
                  <ul className="list-disc pl-6 text-gray-700">
                    <li>provision of Services (contract execution);</li>
                    <li>INSEAD eligibility verification (legitimate interest / pre-contractual measures);</li>
                    <li>billing/accounting (legal obligation);</li>
                    <li>security, fraud/abuse prevention, moderation (legitimate interest);</li>
                    <li>audience via Google Analytics 4 (GA4) (consent);</li>
                    <li>support (contract / legitimate interest).</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Recipients</h2>
                  <ul className="list-disc pl-6 text-gray-700">
                    <li>authorized internal teams;</li>
                    <li>technical service providers (OVHcloud hosting, operation tools);</li>
                    <li>Stripe (payments and Stripe Connect);</li>
                    <li>Google (GA4) when activated after consent.</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Transfers Outside the EU</h2>
                  <p className="text-gray-700">
                    Some service providers may involve transfers outside the EEA. In this case, Hellofonty
                    implements appropriate safeguards (notably standard contractual clauses).
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Retention</h2>
                  <p className="text-gray-700 mb-4">
                    Hellofonty retains data for the period necessary for the purposes, then deletes or archives
                    it in a limited manner to comply with legal obligations (accounting, proof, litigation).
                  </p>
                  <p className="text-gray-700">
                    The INSEAD certificate is retained only for the time strictly necessary for verification
                    and fraud prevention, then deleted/archived with restricted access if necessary.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Security</h2>
                  <p className="text-gray-700">
                    Reasonable security measures: access control, encryption in transit, logging,
                    restricted access to certificates.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Your Rights</h2>
                  <p className="text-gray-700 mb-4">
                    Access, rectification, erasure, limitation, opposition, portability (subject to conditions).
                  </p>
                  <p className="text-gray-700">
                    <strong>Exercise:</strong>{' '}
                    <a href="mailto:support@hellofonty.fr" className="text-rose-600 hover:text-rose-700">
                      support@hellofonty.fr
                    </a>
                    <br />
                    <strong>Complaint:</strong> CNIL
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Cookie Policy</h2>
                  <p className="text-gray-700 mb-4">The Site uses:</p>
                  <ul className="list-disc pl-6 text-gray-700 mb-4">
                    <li>necessary cookies (authentication, security, session);</li>
                    <li>audience measurement cookies via GA4 (subject to consent);</li>
                    <li>other possible cookies described in the cookie manager.</li>
                  </ul>
                  <p className="text-gray-700">
                    On first visit, a banner allows you to accept/refuse non-essential cookies.
                    You can change your choice at any time via the cookie manager.
                  </p>
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
