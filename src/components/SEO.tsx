import { useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
    section?: string;
    tags?: string[];
  };
  noindex?: boolean;
}

export default function SEO({
  title,
  description,
  image,
  url,
  type = 'website',
  article,
  noindex = false,
}: SEOProps) {
  const { language } = useLanguage();

  const baseTitle = 'HELLOFONTY';
  const defaultDescription = language === 'fr'
    ? 'Location de logements étudiants à Fontainebleau pour les étudiants INSEAD. Trouvez votre appartement meublé près du campus.'
    : 'Student housing rentals in Fontainebleau for INSEAD students. Find your furnished apartment near campus.';

  const fullTitle = title ? `${title} | ${baseTitle}` : baseTitle;
  const finalDescription = description || defaultDescription;
  const finalImage = image || '/logo.png';
  const finalUrl = url || window.location.href;
  const canonicalUrl = finalUrl.split('?')[0];

  useEffect(() => {
    document.title = fullTitle;

    const updateMetaTag = (name: string, content: string, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      let element = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement;

      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }

      element.content = content;
    };

    const updateLinkTag = (rel: string, href: string) => {
      let element = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;

      if (!element) {
        element = document.createElement('link');
        element.rel = rel;
        document.head.appendChild(element);
      }

      element.href = href;
    };

    updateMetaTag('description', finalDescription);
    updateMetaTag('robots', noindex ? 'noindex, nofollow' : 'index, follow');

    updateMetaTag('og:title', fullTitle, true);
    updateMetaTag('og:description', finalDescription, true);
    updateMetaTag('og:image', finalImage, true);
    updateMetaTag('og:url', finalUrl, true);
    updateMetaTag('og:type', type, true);
    updateMetaTag('og:site_name', baseTitle, true);
    updateMetaTag('og:locale', language === 'fr' ? 'fr_FR' : 'en_US', true);

    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', fullTitle);
    updateMetaTag('twitter:description', finalDescription);
    updateMetaTag('twitter:image', finalImage);

    updateLinkTag('canonical', canonicalUrl);

    const alternateLang = language === 'fr' ? 'en' : 'fr';
    const alternateUrl = canonicalUrl + (canonicalUrl.includes('?') ? '&' : '?') + `lang=${alternateLang}`;
    updateLinkTag('alternate', alternateUrl);

    if (type === 'article' && article) {
      if (article.publishedTime) {
        updateMetaTag('article:published_time', article.publishedTime, true);
      }
      if (article.modifiedTime) {
        updateMetaTag('article:modified_time', article.modifiedTime, true);
      }
      if (article.author) {
        updateMetaTag('article:author', article.author, true);
      }
      if (article.section) {
        updateMetaTag('article:section', article.section, true);
      }
      if (article.tags) {
        article.tags.forEach((tag) => {
          const existingTag = document.querySelector(`meta[property="article:tag"][content="${tag}"]`);
          if (!existingTag) {
            const tagElement = document.createElement('meta');
            tagElement.setAttribute('property', 'article:tag');
            tagElement.content = tag;
            document.head.appendChild(tagElement);
          }
        });
      }
    }
  }, [fullTitle, finalDescription, finalImage, finalUrl, canonicalUrl, language, type, article, noindex]);

  return null;
}
