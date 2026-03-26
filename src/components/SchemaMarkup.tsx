import { useEffect } from 'react';

interface SchemaMarkupProps {
  type: 'Organization' | 'Article' | 'LocalBusiness' | 'BreadcrumbList' | 'WebSite' | 'ApartmentComplex';
  data: any;
}

export default function SchemaMarkup({ type, data }: SchemaMarkupProps) {
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = `schema-${type.toLowerCase()}-${Date.now()}`;

    let schemaData: any = {};

    switch (type) {
      case 'Organization':
        schemaData = {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Hellofonty',
          alternateName: 'HELLOFONTY',
          url: 'https://www.hellofonty.fr',
          logo: {
            '@type': 'ImageObject',
            url: 'https://www.hellofonty.fr/Flatinbleau-Logo.png',
            width: 200,
            height: 200,
          },
          description: data.description || 'Plateforme de location de logements étudiants à Fontainebleau pour les étudiants INSEAD',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Fontainebleau',
            postalCode: '77300',
            addressCountry: 'FR',
          },
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'Customer Service',
            availableLanguage: ['French', 'English'],
          },
          sameAs: data.socialLinks || [],
        };
        break;

      case 'Article':
        schemaData = {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: data.title,
          description: data.description,
          image: data.image,
          datePublished: data.publishedTime,
          dateModified: data.modifiedTime || data.publishedTime,
          author: {
            '@type': 'Organization',
            name: 'HELLOFONTY',
          },
          publisher: {
            '@type': 'Organization',
            name: 'Hellofonty',
            logo: {
              '@type': 'ImageObject',
              url: 'https://www.hellofonty.fr/Flatinbleau-Logo.png',
            },
          },
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': data.url,
          },
        };
        break;

      case 'LocalBusiness':
        schemaData = {
          '@context': 'https://schema.org',
          '@type': 'LocalBusiness',
          name: 'Hellofonty',
          description: 'Location de logements étudiants à Fontainebleau',
          url: 'https://www.hellofonty.fr',
          telephone: data.telephone || '',
          address: {
            '@type': 'PostalAddress',
            streetAddress: data.streetAddress || '',
            addressLocality: 'Fontainebleau',
            postalCode: '77300',
            addressCountry: 'FR',
          },
          geo: {
            '@type': 'GeoCoordinates',
            latitude: 48.4084,
            longitude: 2.7004,
          },
          openingHoursSpecification: data.openingHours || [],
        };
        break;

      case 'BreadcrumbList':
        schemaData = {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: data.items.map((item: any, index: number) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url,
          })),
        };
        break;

      case 'WebSite':
        schemaData = {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Hellofonty',
          alternateName: 'HELLOFONTY',
          url: 'https://www.hellofonty.fr',
          description: 'Plateforme de logement étudiant à Fontainebleau pour les étudiants INSEAD.',
          inLanguage: 'fr-FR',
          potentialAction: {
            '@type': 'SearchAction',
            target: {
              '@type': 'EntryPoint',
              urlTemplate: 'https://www.hellofonty.fr/recherche?q={search_term_string}',
            },
            'query-input': 'required name=search_term_string',
          },
        };
        break;

      case 'ApartmentComplex':
        schemaData = {
          '@context': 'https://schema.org',
          '@type': 'ApartmentComplex',
          name: data.name,
          description: data.description,
          address: {
            '@type': 'PostalAddress',
            streetAddress: data.address,
            addressLocality: data.city || 'Fontainebleau',
            postalCode: data.postalCode || '77300',
            addressCountry: 'FR',
          },
          geo: data.coordinates ? {
            '@type': 'GeoCoordinates',
            latitude: data.coordinates.lat,
            longitude: data.coordinates.lng,
          } : undefined,
          numberOfBedrooms: data.bedrooms,
          numberOfBathroomsTotal: data.bathrooms,
          floorSize: {
            '@type': 'QuantitativeValue',
            value: data.area,
            unitCode: 'MTK',
          },
          amenityFeature: data.amenities?.map((amenity: string) => ({
            '@type': 'LocationFeatureSpecification',
            name: amenity,
          })),
        };
        break;
    }

    script.textContent = JSON.stringify(schemaData);
    document.head.appendChild(script);

    return () => {
      const existingScript = document.getElementById(script.id);
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [type, data]);

  return null;
}
