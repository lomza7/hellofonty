import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Mail, Phone, Facebook, Instagram, Linkedin, BookOpen } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function Footer() {
  const { language, t } = useLanguage();
  const navigate = useNavigate();

  const scrollToFAQ = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/');
    setTimeout(() => {
      const faqSection = document.getElementById('faq');
      if (faqSection) {
        faqSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };
  return (
    <footer className="relative bg-gradient-to-br from-gray-900 via-gray-900 to-rose-950 text-gray-300 overflow-hidden">
      {/* Decorative background circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-20 -right-40 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/3 left-1/3 w-80 h-80 bg-rose-400/5 rounded-full blur-3xl"></div>
      </div>

      {/* Large HELLOFONTY text background */}
      <div className="absolute inset-0 flex items-start justify-center pt-8 sm:pt-12 lg:pt-16 pointer-events-none overflow-hidden">
        <h2 className="text-[3rem] sm:text-[4rem] md:text-[6rem] lg:text-[8rem] xl:text-[10rem] font-black text-white/[0.03] tracking-tighter leading-none whitespace-nowrap select-none px-4">
          HELLOFONTY
        </h2>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-10 lg:gap-12">
          <div>
            <h3 className="text-white text-lg sm:text-xl font-bold mb-3 sm:mb-5 bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent">
              HELLOFONTY
            </h3>
            <p className="text-sm leading-relaxed mb-4 sm:mb-6 text-gray-400">
              {t('footer.aboutDesc')}
            </p>
            <address className="not-italic text-sm text-gray-500 space-y-1">
              <p className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 text-rose-400 flex-shrink-0" />
                <span>
                  3 rue Paul Tavernier<br />
                  77300 Fontainebleau<br />
                  France
                </span>
              </p>
            </address>
          </div>

          <div>
            <h3 className="text-white text-base font-bold mb-3 sm:mb-5 tracking-wide">
              {language === 'fr' ? 'Pour les étudiants' : 'For Students'}
            </h3>
            <ul className="space-y-2 sm:space-y-3">
              <li>
                <Link
                  to="/recherche"
                  className="text-sm text-gray-400 hover:text-rose-400 transition-all duration-200 block group"
                >
                  <span className="relative">
                    {t('footer.searchListing')}
                    <span className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-rose-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></span>
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  to="/connexion"
                  className="text-sm text-gray-400 hover:text-rose-400 transition-all duration-200 block group"
                >
                  <span className="relative">
                    {t('nav.signIn')}
                    <span className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-rose-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></span>
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  to="/inscription"
                  className="text-sm text-gray-400 hover:text-rose-400 transition-all duration-200 block group"
                >
                  <span className="relative">
                    {t('nav.signUp')}
                    <span className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-rose-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></span>
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  to="/blog"
                  className="text-sm text-gray-400 hover:text-rose-400 transition-all duration-200 flex items-center gap-2 group"
                >
                  <BookOpen className="w-4 h-4" />
                  <span className="relative">
                    Blog
                    <span className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-rose-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></span>
                  </span>
                </Link>
              </li>
              <li>
                <a
                  href="/#faq"
                  onClick={scrollToFAQ}
                  className="text-sm text-gray-400 hover:text-rose-400 transition-all duration-200 block cursor-pointer group"
                >
                  <span className="relative">
                    FAQ
                    <span className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-rose-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></span>
                  </span>
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white text-base font-bold mb-3 sm:mb-5 tracking-wide">
              {language === 'fr' ? 'Pour les propriétaires' : 'For Landlords'}
            </h3>
            <ul className="space-y-2 sm:space-y-3">
              <li>
                <Link
                  to="/ajouter-annonce"
                  className="text-sm text-gray-400 hover:text-rose-400 transition-all duration-200 block group"
                >
                  <span className="relative">
                    {t('footer.postListing')}
                    <span className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-rose-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></span>
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  to="/tarifs"
                  className="text-sm text-gray-400 hover:text-rose-400 transition-all duration-200 block group"
                >
                  <span className="relative">
                    {t('footer.pricing')}
                    <span className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-rose-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></span>
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  to="/inscription"
                  className="text-sm text-gray-400 hover:text-rose-400 transition-all duration-200 block group"
                >
                  <span className="relative">
                    {language === 'fr' ? 'Devenir propriétaire' : 'Become a Landlord'}
                    <span className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-rose-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></span>
                  </span>
                </Link>
              </li>
              <li>
                <a
                  href="/#faq"
                  onClick={scrollToFAQ}
                  className="text-sm text-gray-400 hover:text-rose-400 transition-all duration-200 block cursor-pointer group"
                >
                  <span className="relative">
                    FAQ
                    <span className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-rose-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></span>
                  </span>
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white text-base font-bold mb-3 sm:mb-5 tracking-wide">
              {t('footer.contact')}
            </h3>
            <ul className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
              <li className="flex items-center gap-2 sm:gap-3 group">
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-rose-500/10 rounded-lg flex items-center justify-center group-hover:bg-rose-500/20 transition-colors">
                  <Mail className="w-4 h-4 text-rose-400 flex-shrink-0" />
                </div>
                <a
                  href="mailto:contact@hellofonty.com"
                  className="text-sm text-gray-400 hover:text-rose-400 transition-colors"
                >
                  contact@hellofonty.com
                </a>
              </li>
              <li className="flex items-center gap-2 sm:gap-3 group">
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-rose-500/10 rounded-lg flex items-center justify-center group-hover:bg-rose-500/20 transition-colors">
                  <Phone className="w-4 h-4 text-rose-400 flex-shrink-0" />
                </div>
                <a
                  href="tel:+33123456789"
                  className="text-sm text-gray-400 hover:text-rose-400 transition-colors"
                >
                  +33 1 23 45 67 89
                </a>
              </li>
            </ul>
            <h4 className="text-white text-sm font-bold mb-3 sm:mb-4 tracking-wide">
              {t('footer.followUs')}
            </h4>
            <div className="flex gap-2 sm:gap-3">
              <a
                href="#"
                className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-rose-500/10 to-pink-500/10 backdrop-blur-sm rounded-xl flex items-center justify-center hover:from-rose-500 hover:to-pink-500 transition-all duration-300 transform hover:scale-110 hover:shadow-lg hover:shadow-rose-500/20"
                aria-label="Facebook"
              >
                <Facebook className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-rose-500/10 to-pink-500/10 backdrop-blur-sm rounded-xl flex items-center justify-center hover:from-rose-500 hover:to-pink-500 transition-all duration-300 transform hover:scale-110 hover:shadow-lg hover:shadow-rose-500/20"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-rose-500/10 to-pink-500/10 backdrop-blur-sm rounded-xl flex items-center justify-center hover:from-rose-500 hover:to-pink-500 transition-all duration-300 transform hover:scale-110 hover:shadow-lg hover:shadow-rose-500/20"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800/50 mt-8 sm:mt-10 lg:mt-12 pt-6 sm:pt-8 text-center">
          <p className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} HELLOFONTY. {t('footer.rights')}.
          </p>
          <p className="text-xs mt-2 text-gray-600">
            {language === 'fr'
              ? 'Plateforme de logement pour étudiants INSEAD à Fontainebleau'
              : 'Housing platform for INSEAD students in Fontainebleau'}
          </p>
        </div>
      </div>
    </footer>
  );
}
