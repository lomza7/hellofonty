import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface BreadcrumbItem {
  label: string;
  path: string;
}

export default function Breadcrumb() {
  const location = useLocation();
  const { language } = useLanguage();

  const pathSegments = location.pathname.split('/').filter(Boolean);

  if (pathSegments.length === 0) {
    return null;
  }

  const breadcrumbMap: Record<string, { fr: string; en: string }> = {
    blog: { fr: 'Blog', en: 'Blog' },
    recherche: { fr: 'Recherche', en: 'Search' },
    tarifs: { fr: 'Tarifs', en: 'Pricing' },
    favoris: { fr: 'Favoris', en: 'Favorites' },
    messages: { fr: 'Messages', en: 'Messages' },
    profil: { fr: 'Profil', en: 'Profile' },
    'mes-annonces': { fr: 'Mes Annonces', en: 'My Listings' },
    'ajouter-annonce': { fr: 'Nouvelle Annonce', en: 'New Listing' },
    'modifier-annonce': { fr: 'Modifier Annonce', en: 'Edit Listing' },
    'mes-demandes': { fr: 'Mes Demandes', en: 'My Requests' },
    'mes-reservations': { fr: 'Mes Réservations', en: 'My Bookings' },
    'mes-documents': { fr: 'Mes Documents', en: 'My Documents' },
    'documents-proprietaire': { fr: 'Documents', en: 'Documents' },
    'mon-abonnement': { fr: 'Mon Abonnement', en: 'My Subscription' },
    'guide-acces': { fr: 'Guide d\'Accès', en: 'Access Guide' },
    'etat-des-lieux': { fr: 'État des Lieux', en: 'Inventory' },
    'mes-baux': { fr: 'Mes Baux', en: 'My Leases' },
    admin: { fr: 'Administration', en: 'Administration' },
    logement: { fr: 'Logement', en: 'Listing' },
  };

  const breadcrumbs: BreadcrumbItem[] = [
    {
      label: language === 'fr' ? 'Accueil' : 'Home',
      path: '/',
    },
  ];

  let currentPath = '';
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;

    const mapping = breadcrumbMap[segment];
    if (mapping) {
      breadcrumbs.push({
        label: language === 'fr' ? mapping.fr : mapping.en,
        path: currentPath,
      });
    } else if (index === pathSegments.length - 1) {
      breadcrumbs.push({
        label: decodeURIComponent(segment),
        path: currentPath,
      });
    }
  });

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <ol className="flex items-center space-x-2 text-sm">
          {breadcrumbs.map((crumb, index) => (
            <li key={crumb.path} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="w-4 h-4 text-gray-400 mx-2" />
              )}
              {index === breadcrumbs.length - 1 ? (
                <span className="text-gray-900 font-medium flex items-center gap-1">
                  {index === 0 && <Home className="w-4 h-4" />}
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.path}
                  className="text-gray-600 hover:text-blue-600 transition flex items-center gap-1"
                >
                  {index === 0 && <Home className="w-4 h-4" />}
                  {crumb.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
