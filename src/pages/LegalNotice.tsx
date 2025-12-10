import { useLanguage } from '../contexts/LanguageContext';
import SEO from '../components/SEO';

export default function LegalNotice() {
  const { language } = useLanguage();

  return (
    <>
      <SEO
        title={language === 'fr' ? 'Mentions légales' : 'Legal Notice'}
        description={language === 'fr' ? 'Mentions légales de Hellofonty' : 'Hellofonty legal notice'}
      />

      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-sm p-8">
            {language === 'fr' ? (
              <>
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Mentions légales</h1>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Éditeur</h2>
                  <p className="text-gray-700 mb-4">
                    Le site Hellofonty (ci-après le « Site »), accessible à l'adresse{' '}
                    <a href="https://hellofonty.fr" className="text-rose-600 hover:text-rose-700">
                      https://hellofonty.fr
                    </a>
                    , est édité par :
                  </p>
                  <p className="text-gray-700 mb-2">
                    <strong>HELLOFONTY</strong>, SAS au capital de 10 000 €, immatriculée au RCS de Melun,
                    sous le numéro SIRET 913 330 293 12, dont le siège social est situé 3 rue Paul Tavernier,
                    77300 Fontainebleau, France.
                  </p>
                  <p className="text-gray-700 mb-2">
                    <strong>Directeur de la publication :</strong> Louis MAAZA
                  </p>
                  <p className="text-gray-700">
                    <strong>Contact :</strong>{' '}
                    <a href="mailto:support@hellofonty.fr" className="text-rose-600 hover:text-rose-700">
                      support@hellofonty.fr
                    </a>
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Hébergement</h2>
                  <p className="text-gray-700">
                    Le Site est hébergé par OVHcloud :<br />
                    OVH SAS, 2 rue Kellermann, 59100 Roubaix, France.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Activité – rôle de la plateforme</h2>
                  <p className="text-gray-700">
                    Hellofonty est une plateforme de mise en relation entre bailleurs et locataires,
                    et fournit des outils de facilitation (messagerie, réservation, paiements,
                    génération de documents, synchronisation calendrier, etc.).
                    Sauf mention expresse, Hellofonty n'est pas partie au contrat de location conclu
                    entre bailleur et locataire et n'agit pas en qualité d'agent immobilier.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Propriété intellectuelle</h2>
                  <p className="text-gray-700">
                    Le Site, sa structure et ses contenus (textes, images, logos, marques, bases de données)
                    sont protégés. Toute reproduction, représentation, adaptation ou exploitation non autorisée
                    est interdite.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Signalement</h2>
                  <p className="text-gray-700">
                    Tout signalement relatif à un contenu, un comportement ou une annonce peut être adressé à :{' '}
                    <a href="mailto:support@hellofonty.fr" className="text-rose-600 hover:text-rose-700">
                      support@hellofonty.fr
                    </a>
                  </p>
                </section>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Legal Notice</h1>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Publisher</h2>
                  <p className="text-gray-700 mb-4">
                    The Hellofonty website (hereinafter the "Site"), accessible at{' '}
                    <a href="https://hellofonty.fr" className="text-rose-600 hover:text-rose-700">
                      https://hellofonty.fr
                    </a>
                    , is published by:
                  </p>
                  <p className="text-gray-700 mb-2">
                    <strong>HELLOFONTY</strong>, SAS with a capital of €10,000, registered with the Melun RCS,
                    under SIRET number 913 330 293 12, with registered office at 3 rue Paul Tavernier,
                    77300 Fontainebleau, France.
                  </p>
                  <p className="text-gray-700 mb-2">
                    <strong>Publication Director:</strong> Louis MAAZA
                  </p>
                  <p className="text-gray-700">
                    <strong>Contact:</strong>{' '}
                    <a href="mailto:support@hellofonty.fr" className="text-rose-600 hover:text-rose-700">
                      support@hellofonty.fr
                    </a>
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Hosting</h2>
                  <p className="text-gray-700">
                    The Site is hosted by OVHcloud:<br />
                    OVH SAS, 2 rue Kellermann, 59100 Roubaix, France.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Activity – Platform Role</h2>
                  <p className="text-gray-700">
                    Hellofonty is a platform connecting landlords and tenants, providing facilitation tools
                    (messaging, booking, payments, document generation, calendar synchronization, etc.).
                    Unless expressly stated, Hellofonty is not a party to the rental agreement between
                    landlord and tenant and does not act as a real estate agent.
                  </p>
                </section>

                <section className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Intellectual Property</h2>
                  <p className="text-gray-700">
                    The Site, its structure and content (texts, images, logos, trademarks, databases)
                    are protected. Any unauthorized reproduction, representation, adaptation or exploitation
                    is prohibited.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Reporting</h2>
                  <p className="text-gray-700">
                    Any report regarding content, behavior or listing can be sent to:{' '}
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
