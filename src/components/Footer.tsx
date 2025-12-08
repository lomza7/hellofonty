import { Link } from 'react-router-dom';
import { MapPin, Mail, Phone, Facebook, Instagram, Linkedin, BookOpen } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function Footer() {
  const { language, t } = useLanguage();
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-white text-lg font-semibold mb-4">HELLOFONTY</h3>
            <p className="text-sm leading-relaxed mb-4">
              {t('footer.aboutDesc')}
            </p>
            <address className="not-italic text-sm text-gray-400">
              3 rue Paul Tavernier<br />
              77300 Fontainebleau<br />
              France
            </address>
          </div>

          <div>
            <h3 className="text-white text-lg font-semibold mb-4">{language === 'fr' ? 'Pour les étudiants' : 'For Students'}</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/recherche"
                  className="text-sm hover:text-white transition-colors block"
                >
                  {t('footer.searchListing')}
                </Link>
              </li>
              <li>
                <Link
                  to="/connexion"
                  className="text-sm hover:text-white transition-colors block"
                >
                  {t('nav.signIn')}
                </Link>
              </li>
              <li>
                <Link
                  to="/inscription"
                  className="text-sm hover:text-white transition-colors block"
                >
                  {t('nav.signUp')}
                </Link>
              </li>
              <li>
                <Link
                  to="/blog"
                  className="text-sm hover:text-white transition-colors flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Blog</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/#faq"
                  className="text-sm hover:text-white transition-colors block"
                >
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white text-lg font-semibold mb-4">{language === 'fr' ? 'Pour les propriétaires' : 'For Landlords'}</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/ajouter-annonce"
                  className="text-sm hover:text-white transition-colors block"
                >
                  {t('footer.postListing')}
                </Link>
              </li>
              <li>
                <Link
                  to="/tarifs"
                  className="text-sm hover:text-white transition-colors block"
                >
                  {t('footer.pricing')}
                </Link>
              </li>
              <li>
                <Link
                  to="/inscription"
                  className="text-sm hover:text-white transition-colors block"
                >
                  {language === 'fr' ? 'Devenir propriétaire' : 'Become a Landlord'}
                </Link>
              </li>
              <li>
                <Link
                  to="/#faq"
                  className="text-sm hover:text-white transition-colors block"
                >
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white text-lg font-semibold mb-4">{t('footer.contact')}</h3>
            <ul className="space-y-3 mb-4">
              <li className="flex items-center gap-2">
                <Mail className="w-5 h-5 flex-shrink-0" />
                <a href="mailto:contact@hellofonty.com" className="text-sm hover:text-white transition-colors">
                  contact@hellofonty.com
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-5 h-5 flex-shrink-0" />
                <a href="tel:+33123456789" className="text-sm hover:text-white transition-colors">
                  +33 1 23 45 67 89
                </a>
              </li>
            </ul>
            <h4 className="text-white text-base font-semibold mb-3">{t('footer.followUs')}</h4>
            <div className="flex gap-4">
              <a
                href="#"
                className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-pink-600 transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center">
          <p className="text-sm">
            &copy; {new Date().getFullYear()} HELLOFONTY. {t('footer.rights')}.
          </p>
          <p className="text-xs mt-2 text-gray-500">
            {language === 'fr'
              ? 'Plateforme de logement pour étudiants INSEAD à Fontainebleau'
              : 'Housing platform for INSEAD students in Fontainebleau'}
          </p>
        </div>
      </div>
    </footer>
  );
}
