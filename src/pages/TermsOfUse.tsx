import { useLanguage } from '../contexts/LanguageContext';
import SEO from '../components/SEO';
import BackButton from '../components/BackButton';

export default function TermsOfUse() {
  const { language } = useLanguage();

  return (
    <>
      <SEO
        title={language === 'fr' ? 'Conditions Générales d\'Utilisation (CGU)' : 'Terms of Use'}
        description={language === 'fr' ? 'Conditions générales d\'utilisation de Hellofonty' : 'Hellofonty terms of use'}
      />

      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <BackButton />
          <div className="bg-white rounded-2xl shadow-sm p-8">
            {language === 'fr' ? (
              <>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Conditions Générales d'Utilisation (CGU)</h1>
                <p className="text-sm text-gray-600 mb-8">
                  Version : Finale — Entrée en vigueur : 08/12/2025
                </p>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Objet</h2>
                  <p className="text-gray-700">
                    Les présentes CGU encadrent l'accès et l'utilisation du Site et des services Hellofonty
                    (les « Services »), notamment : consultation et publication d'annonces, messagerie,
                    demandes et gestion de réservation, paiements, synchronisation calendrier (iCal),
                    et génération de documents (bail, état des lieux/inventaire).
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Définitions</h2>
                  <p className="text-gray-700 mb-2"><strong>Utilisateur :</strong> toute personne naviguant sur le Site.</p>
                  <p className="text-gray-700 mb-2"><strong>Membre :</strong> Utilisateur disposant d'un compte.</p>
                  <p className="text-gray-700 mb-2"><strong>Bailleur :</strong> Membre publiant une annonce.</p>
                  <p className="text-gray-700 mb-2"><strong>Locataire :</strong> Membre sollicitant une réservation et/ou effectuant un paiement.</p>
                  <p className="text-gray-700 mb-2"><strong>Annonce :</strong> offre de location publiée sur le Site.</p>
                  <p className="text-gray-700"><strong>Réservation :</strong> demande/acceptation de location via le Site, pouvant donner lieu à paiement.</p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Accès aux Services – éligibilité Locataires (INSEAD)</h2>
                  <p className="text-gray-700 mb-4">
                    Les Services côté locataires sont destinés aux étudiants INSEAD. L'accès peut être conditionné
                    à la transmission d'un justificatif de scolarité (attestation). Hellofonty se réserve le droit
                    de refuser, suspendre ou limiter l'accès en l'absence de justificatif ou en cas de fraude.
                  </p>
                  <p className="text-gray-700">
                    Les Services côté bailleurs sont ouverts (non limités aux étudiants INSEAD).
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Création de compte – sécurité</h2>
                  <p className="text-gray-700">
                    Le Membre s'engage à fournir des informations exactes, à les maintenir à jour, et à préserver
                    la confidentialité de ses identifiants. Toute activité réalisée depuis le compte est présumée
                    effectuée par le Membre, sauf preuve contraire.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Rôle de Hellofonty – plateforme d'intermédiation</h2>
                  <p className="text-gray-700 mb-4">
                    Hellofonty fournit une infrastructure technique de mise en relation et de facilitation.
                    Le bail, et plus généralement l'ensemble des obligations liées à la location (loyer, charges,
                    dépôt de garantie, état du logement, conformité légale, assurance, etc.) relèvent du bailleur
                    et du locataire.
                  </p>
                  <p className="text-gray-700">
                    Hellofonty ne garantit pas la qualité, la conformité, la décence, l'état ou la disponibilité
                    d'un logement, ni l'identité, la solvabilité ou le comportement des Membres.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Publication d'annonces – obligations du Bailleur</h2>
                  <p className="text-gray-700">
                    Le Bailleur garantit disposer des droits nécessaires pour proposer le bien et publier une annonce
                    fidèle (prix, charges, disponibilités, règles, photos). Hellofonty peut retirer/déréférencer toute
                    annonce trompeuse, incomplète ou contraire aux CGU.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Messagerie – modération – échanges "hors plateforme"</h2>
                  <p className="text-gray-700 mb-4">
                    Pour des raisons de sécurité et de qualité, Hellofonty met en œuvre des mécanismes de modération
                    pouvant notamment :
                  </p>
                  <ul className="list-disc pl-6 text-gray-700 mb-4">
                    <li>limiter l'échange de coordonnées directes (téléphone, email, liens, etc.) avant confirmation d'une réservation ;</li>
                    <li>détecter et filtrer des contenus inappropriés (ex. insultes, menaces, harcèlement).</li>
                  </ul>
                  <p className="text-gray-700">
                    Le Membre reconnaît que ces mécanismes peuvent produire des erreurs et s'engage à utiliser un langage
                    respectueux. Hellofonty se réserve le droit de sanctionner toute violation (suspension, suppression de
                    contenu, fermeture de compte).
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Réservations – annulation</h2>
                  <p className="text-gray-700 mb-4">
                    Les conditions de location (dates, prix, règles, modalités) sont celles indiquées dans l'Annonce et
                    au moment de la confirmation.
                  </p>
                  <p className="text-gray-700">
                    <strong>Annulation :</strong> sauf indication contraire sur le Site, l'annulation et ses conditions
                    (acceptation, pénalités, remboursement) sont déterminées par le bailleur. Hellofonty n'est pas
                    responsable d'un refus d\'annulation ou d'un désaccord entre parties.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Paiements – Stripe Connect – frais de plateforme</h2>
                  <p className="text-gray-700 mb-4">
                    Hellofonty utilise un prestataire de paiement (Stripe) et peut proposer :
                  </p>
                  <ul className="list-disc pl-6 text-gray-700 mb-4">
                    <li>des frais de plateforme facturés aux locataires ;</li>
                    <li>un abonnement Premium optionnel (sans engagement) pour les bailleurs.</li>
                  </ul>
                  <p className="text-gray-700">
                    <strong>Encaissement :</strong> Hellofonty n'encaisse pas les loyers pour le compte des bailleurs.
                    Les fonds destinés au bailleur transitent via Stripe Connect selon les modalités techniques mises en place.
                    Hellofonty n'est pas responsable des exigences de conformité (KYC), refus ou délais imposés par Stripe.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Dépôt de garantie</h2>
                  <p className="text-gray-700">
                    Lorsque la plateforme permet le paiement d'un dépôt de garantie, celui-ci est versé au bailleur
                    (notamment lors du premier virement). La gestion du dépôt (retenues, restitution, litige) s'effectue
                    ensuite directement entre bailleur et locataire en fin de location. Hellofonty n'intervient pas dans
                    ce processus.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Documents (bail / état des lieux)</h2>
                  <p className="text-gray-700">
                    Hellofonty peut proposer des documents générés à partir des informations fournies par les Membres.
                    Ils constituent une assistance et ne remplacent pas un conseil juridique. Les parties restent
                    responsables de la conformité, des annexes obligatoires, des signatures et de la conservation des preuves.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Interdictions</h2>
                  <p className="text-gray-700">
                    Sont interdits : contenus illicites, discriminatoires, violents, menaçants, harcèlement, fraude, spam,
                    tentative de contournement des règles de la plateforme, atteintes aux droits d'autrui.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">13. Responsabilité – limitation</h2>
                  <p className="text-gray-700">
                    Hellofonty est responsable uniquement des dommages directs prouvés résultant d'une faute qui lui est
                    imputable. Hellofonty n'est pas responsable des annonces et contenus des Membres, ni des litiges,
                    annulations, défauts de paiement, dégradations, ou pertes indirectes, dans les limites autorisées par la loi.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">14. Suspension / résiliation</h2>
                  <p className="text-gray-700">
                    Hellofonty peut suspendre ou résilier un compte en cas de manquement aux CGU, fraude, risque de sécurité
                    ou obligation légale.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">15. Droit applicable – litiges</h2>
                  <p className="text-gray-700">
                    Les CGU sont régies par le droit français. En cas de litige, les parties rechercheront une solution
                    amiable avant toute action judiciaire.
                  </p>
                </section>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Terms of Use</h1>
                <p className="text-sm text-gray-600 mb-8">
                  Version: Final — Effective Date: December 8, 2025
                </p>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Purpose</h2>
                  <p className="text-gray-700">
                    These Terms of Use govern access to and use of the Site and Hellofonty services (the "Services"),
                    including: viewing and publishing listings, messaging, booking requests and management, payments,
                    calendar synchronization (iCal), and document generation (lease, inventory).
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Definitions</h2>
                  <p className="text-gray-700 mb-2"><strong>User:</strong> any person browsing the Site.</p>
                  <p className="text-gray-700 mb-2"><strong>Member:</strong> User with an account.</p>
                  <p className="text-gray-700 mb-2"><strong>Landlord:</strong> Member publishing a listing.</p>
                  <p className="text-gray-700 mb-2"><strong>Tenant:</strong> Member requesting a booking and/or making a payment.</p>
                  <p className="text-gray-700 mb-2"><strong>Listing:</strong> rental offer published on the Site.</p>
                  <p className="text-gray-700"><strong>Booking:</strong> rental request/acceptance via the Site, which may result in payment.</p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Access to Services – Tenant Eligibility (INSEAD)</h2>
                  <p className="text-gray-700 mb-4">
                    Services for tenants are intended for INSEAD students. Access may be conditional on providing proof
                    of enrollment. Hellofonty reserves the right to refuse, suspend or limit access in the absence of
                    proof or in case of fraud.
                  </p>
                  <p className="text-gray-700">
                    Services for landlords are open (not limited to INSEAD students).
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Account Creation – Security</h2>
                  <p className="text-gray-700">
                    Members agree to provide accurate information, keep it up to date, and maintain the confidentiality
                    of their credentials. Any activity from the account is presumed to be performed by the Member,
                    unless proven otherwise.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Role of Hellofonty – Intermediation Platform</h2>
                  <p className="text-gray-700 mb-4">
                    Hellofonty provides a technical infrastructure for connection and facilitation. The lease, and more
                    generally all rental obligations (rent, charges, security deposit, housing condition, legal compliance,
                    insurance, etc.) are the responsibility of the landlord and tenant.
                  </p>
                  <p className="text-gray-700">
                    Hellofonty does not guarantee the quality, compliance, decency, condition or availability of housing,
                    nor the identity, solvency or behavior of Members.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Listing Publication – Landlord Obligations</h2>
                  <p className="text-gray-700">
                    The Landlord guarantees having the necessary rights to offer the property and publish an accurate
                    listing (price, charges, availability, rules, photos). Hellofonty may remove any misleading,
                    incomplete or non-compliant listing.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Messaging – Moderation – "Off-Platform" Exchanges</h2>
                  <p className="text-gray-700 mb-4">
                    For security and quality reasons, Hellofonty implements moderation mechanisms that may:
                  </p>
                  <ul className="list-disc pl-6 text-gray-700 mb-4">
                    <li>limit the exchange of direct contact information (phone, email, links, etc.) before booking confirmation;</li>
                    <li>detect and filter inappropriate content (e.g. insults, threats, harassment).</li>
                  </ul>
                  <p className="text-gray-700">
                    Members acknowledge that these mechanisms may produce errors and agree to use respectful language.
                    Hellofonty reserves the right to sanction any violation (suspension, content removal, account closure).
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Bookings – Cancellation</h2>
                  <p className="text-gray-700 mb-4">
                    Rental conditions (dates, prices, rules, terms) are those indicated in the Listing and at confirmation.
                  </p>
                  <p className="text-gray-700">
                    <strong>Cancellation:</strong> unless otherwise stated on the Site, cancellation and its conditions
                    (acceptance, penalties, refund) are determined by the landlord. Hellofonty is not responsible for
                    cancellation refusals or disagreements between parties.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Payments – Stripe Connect – Platform Fees</h2>
                  <p className="text-gray-700 mb-4">
                    Hellofonty uses a payment provider (Stripe) and may offer:
                  </p>
                  <ul className="list-disc pl-6 text-gray-700 mb-4">
                    <li>platform fees charged to tenants;</li>
                    <li>an optional Premium subscription (no commitment) for landlords.</li>
                  </ul>
                  <p className="text-gray-700">
                    <strong>Collection:</strong> Hellofonty does not collect rent on behalf of landlords. Funds intended
                    for the landlord transit via Stripe Connect according to the technical arrangements in place.
                    Hellofonty is not responsible for compliance requirements (KYC), refusals or delays imposed by Stripe.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Security Deposit</h2>
                  <p className="text-gray-700">
                    When the platform allows payment of a security deposit, it is paid to the landlord (notably during
                    the first transfer). Deposit management (deductions, return, dispute) is then handled directly
                    between landlord and tenant at the end of the rental. Hellofonty does not intervene in this process.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Documents (Lease / Inventory)</h2>
                  <p className="text-gray-700">
                    Hellofonty may provide documents generated from information provided by Members. They constitute
                    assistance and do not replace legal advice. Parties remain responsible for compliance, mandatory
                    annexes, signatures and preservation of evidence.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Prohibitions</h2>
                  <p className="text-gray-700">
                    Prohibited: illegal, discriminatory, violent, threatening content, harassment, fraud, spam,
                    attempts to circumvent platform rules, infringement of others' rights.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">13. Liability – Limitation</h2>
                  <p className="text-gray-700">
                    Hellofonty is only responsible for proven direct damages resulting from a fault attributable to it.
                    Hellofonty is not responsible for Member listings and content, nor for disputes, cancellations,
                    payment defaults, damage, or indirect losses, within the limits permitted by law.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">14. Suspension / Termination</h2>
                  <p className="text-gray-700">
                    Hellofonty may suspend or terminate an account in case of breach of Terms of Use, fraud,
                    security risk or legal obligation.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">15. Applicable Law – Disputes</h2>
                  <p className="text-gray-700">
                    These Terms of Use are governed by French law. In case of dispute, parties will seek an
                    amicable solution before any legal action.
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
