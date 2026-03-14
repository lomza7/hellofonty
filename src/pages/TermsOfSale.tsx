import { useLanguage } from '../contexts/LanguageContext';
import SEO from '../components/SEO';
import BackButton from '../components/BackButton';

export default function TermsOfSale() {
  const { language } = useLanguage();

  return (
    <>
      <SEO
        title={language === 'fr' ? 'Conditions Générales de Vente (CGV)' : 'Terms of Sale'}
        description={language === 'fr' ? 'Conditions générales de vente de Hellofonty' : 'Hellofonty terms of sale'}
      />

      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <BackButton />
          <div className="bg-white rounded-2xl shadow-sm p-8">
            {language === 'fr' ? (
              <>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                  Conditions Générales de Vente (CGV) – Services payants
                </h1>
                <p className="text-sm text-gray-600 mb-8">
                  Version : Finale — Entrée en vigueur : 07/12/2025
                </p>
                <p className="text-gray-700 mb-8">
                  <strong>Vendeur :</strong> SAS HELLOFONTY (voir Mentions légales)<br />
                  <strong>TVA :</strong> TVA applicable — N° TVA intracom : [à compléter]
                </p>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Objet</h2>
                  <p className="text-gray-700 mb-4">Les présentes CGV régissent la vente :</p>
                  <ul className="list-disc pl-6 text-gray-700">
                    <li>des frais de plateforme facturés aux locataires ;</li>
                    <li>de l'abonnement Premium optionnel (sans engagement) destiné aux bailleurs.</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Prix</h2>
                  <p className="text-gray-700">
                    Les prix applicables sont ceux affichés au moment du paiement, en euros, TVA incluse
                    sauf indication contraire.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Paiement</h2>
                  <p className="text-gray-700">
                    Le paiement est réalisé via Stripe. Hellofonty ne stocke pas les données de carte bancaire.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Frais de plateforme (Locataires)</h2>
                  <p className="text-gray-700">
                    Les frais de plateforme rémunèrent l'accès aux fonctionnalités et services numériques
                    fournis par Hellofonty (mise en relation, messagerie, réservation, outils associés, etc.).
                    Les conditions exactes (montant, moment de facturation, éventuelles exceptions) sont
                    précisées au moment du paiement.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Abonnement Premium (Bailleurs) – sans engagement</h2>
                  <p className="text-gray-700 mb-4">
                    L'abonnement Premium donne accès à des fonctionnalités supplémentaires décrites sur la page Prix.
                  </p>
                  <p className="text-gray-700 mb-4">
                    <strong>Sans engagement :</strong> le bailleur peut résilier à tout moment depuis son espace.
                  </p>
                  <p className="text-gray-700">
                    La résiliation prend effet selon les modalités indiquées lors de la souscription
                    (notamment à l'issue de la période de facturation en cours, sauf indication contraire).
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Remboursements – annulation</h2>
                  <p className="text-gray-700">
                    Sauf disposition impérative, les règles applicables aux annulations/remboursements liées
                    à la location sont déterminées par le bailleur, et les conditions éventuelles relatives
                    aux frais de plateforme sont affichées au moment du paiement.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Support</h2>
                  <p className="text-gray-700">
                    Support :{' '}
                    <a href="mailto:support@hellofonty.fr" className="text-rose-600 hover:text-rose-700">
                      support@hellofonty.fr
                    </a>
                  </p>
                </section>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                  Terms of Sale – Paid Services
                </h1>
                <p className="text-sm text-gray-600 mb-8">
                  Version: Final — Effective Date: December 7, 2025
                </p>
                <p className="text-gray-700 mb-8">
                  <strong>Seller:</strong> SAS HELLOFONTY (see Legal Notice)<br />
                  <strong>VAT:</strong> VAT applicable — Intracom VAT No.: [to be completed]
                </p>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Purpose</h2>
                  <p className="text-gray-700 mb-4">These Terms of Sale govern the sale of:</p>
                  <ul className="list-disc pl-6 text-gray-700">
                    <li>platform fees charged to tenants;</li>
                    <li>optional Premium subscription (no commitment) for landlords.</li>
                  </ul>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Prices</h2>
                  <p className="text-gray-700">
                    Applicable prices are those displayed at the time of payment, in euros, VAT included
                    unless otherwise stated.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Payment</h2>
                  <p className="text-gray-700">
                    Payment is processed via Stripe. Hellofonty does not store credit card data.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Platform Fees (Tenants)</h2>
                  <p className="text-gray-700">
                    Platform fees compensate for access to digital features and services provided by Hellofonty
                    (connection, messaging, booking, associated tools, etc.). Exact conditions (amount,
                    billing time, possible exceptions) are specified at the time of payment.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Premium Subscription (Landlords) – No Commitment</h2>
                  <p className="text-gray-700 mb-4">
                    The Premium subscription provides access to additional features described on the Pricing page.
                  </p>
                  <p className="text-gray-700 mb-4">
                    <strong>No commitment:</strong> landlords can cancel at any time from their account.
                  </p>
                  <p className="text-gray-700">
                    Cancellation takes effect according to the terms indicated during subscription
                    (notably at the end of the current billing period, unless otherwise stated).
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Refunds – Cancellation</h2>
                  <p className="text-gray-700">
                    Unless otherwise required, rules applicable to rental cancellations/refunds are determined
                    by the landlord, and any conditions relating to platform fees are displayed at the time
                    of payment.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Support</h2>
                  <p className="text-gray-700">
                    Support:{' '}
                    <a href="mailto:support@hellofonty.fr" className="text-rose-600 hover:text-rose-700">
                      support@hellofonty.fr
                    </a>
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
