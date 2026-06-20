export const STRIPE_PRODUCTS = {
  MISE_EN_RELATION: {
    id: 'prod_UYkhjrARpZrar2',
    priceId: 'price_1TZdC3GfeWIzLFgwqoNpnm7R',
    name: 'Mise en relation',
    nameEn: 'Matching Service',
    description: 'Service de mise en relation entre étudiants INSEAD et propriétaires vérifiés.',
    descriptionEn: 'Matching service between INSEAD students and verified landlords.',
    price: 299.00,
    currency: 'eur',
    currencySymbol: '€',
    mode: 'payment' as const,
    features: [
      'Accès aux logements vérifiés',
      'Messagerie sécurisée',
      'Paiement en ligne',
      'Bail électronique',
      'Support prioritaire',
    ],
    featuresEn: [
      'Access to verified listings',
      'Secure messaging',
      'Online payment',
      'Electronic lease',
      'Priority support',
    ],
  },
  HELLOFONTY_PREMIUM: {
    id: 'prod_UYkghVauwyjTEw',
    priceId: 'price_1TZdBVGfeWIzLFgw5rnfNHYq',
    name: 'Hellofonty Premium',
    nameEn: 'Hellofonty Premium',
    description: 'Accès complet à toutes les fonctionnalités de gestion pour les propriétaires.',
    descriptionEn: 'Full access to all management features for landlords.',
    price: 59.00,
    currency: 'eur',
    currencySymbol: '€',
    mode: 'subscription' as const,
    features: [
      'Annonces illimitées',
      'Calendrier de disponibilité',
      'Statistiques avancées',
      'Gestion des baux',
      'États des lieux digitaux',
      'Support prioritaire',
    ],
    featuresEn: [
      'Unlimited listings',
      'Availability calendar',
      'Advanced statistics',
      'Lease management',
      'Digital inventory reports',
      'Priority support',
    ],
  },
} as const;

export type StripeProductKey = keyof typeof STRIPE_PRODUCTS;
export type StripeProduct = typeof STRIPE_PRODUCTS[StripeProductKey];