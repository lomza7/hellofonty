export type DetectionType = 'phone' | 'email' | 'url' | 'address' | 'social_media' | 'none';

export interface DetectionResult {
  isBlocked: boolean;
  detectionType: DetectionType;
  detectedPatterns: string[];
}

export function detectProhibitedContent(message: string): DetectionResult {
  return detectContactInfo(message, 'message');
}

export function detectListingContactInfo(text: string): DetectionResult {
  return detectContactInfo(text, 'listing');
}

function detectContactInfo(message: string, context: 'message' | 'listing'): DetectionResult {
  const detectedPatterns: string[] = [];
  let detectionType: DetectionType = 'none';

  const normalizedMessage = message.toLowerCase().replace(/\s+/g, ' ');

  // Phone: real 10-digit French numbers or international format
  const phonePatterns: RegExp[] = [
    /(?:^|\s)(?:\+33|0033|0)\s*[67]\s*(?:\d\s*){8}(?:\s|$)/gi,
    /(?:^|\s)(?:\+33|0033|0)\s*[1-9]\s*(?:\d\s*){8}(?:\s|$)/gi,
    /(?:^|\s)\d{2}[\s.-]\d{2}[\s.-]\d{2}[\s.-]\d{2}[\s.-]\d{2}(?:\s|$)/gi,
  ];

  if (context === 'message') {
    phonePatterns.push(
      /(?:^|\s)(?:\+\d{1,3})?\s*\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{1,9}(?:\s|$)/gi
    );
  }

  for (const pattern of phonePatterns) {
    const matches = message.match(pattern);
    if (matches) {
      const filtered = matches.map(m => m.trim()).filter(m => {
        const digits = m.replace(/\D/g, '');
        return digits.length >= 10;
      });
      if (filtered.length > 0) {
        detectedPatterns.push(...filtered);
        detectionType = 'phone';
      }
    }
  }

  const phoneWordPatterns = [
    /(?:zero|zéro|o)\s*(?:six|7|sept)/gi,
    /appel(?:le|ler|lez)?\s*(?:moi|me)/gi,
    /(?:mon|le|un|ton|votre|your|my)\s*(?:num[ée]ro|tel|t[ée]l[ée]phone|portable|mobile|number|phone)/gi,
    /(?:contact|joindre|appeler)\s*(?:moi|me)\s*(?:au|sur)/gi,
  ];

  for (const pattern of phoneWordPatterns) {
    const matches = normalizedMessage.match(pattern);
    if (matches) {
      detectedPatterns.push(...matches);
      detectionType = 'phone';
    }
  }

  // Email: real email addresses
  const emailPatterns = [
    /[a-z0-9][-a-z0-9._+]*@[a-z0-9][-a-z0-9]*(?:\.[a-z0-9][-a-z0-9]*)*\.[a-z]{2,6}/gi,
    /[a-z0-9]+\s*(?:at|arobase|\[at\]|\(at\))\s*[a-z0-9]+\s*(?:dot|point|\[dot\]|\(dot\))\s*(?:com|fr|net|org|io|co)/gi,
  ];

  for (const pattern of emailPatterns) {
    const matches = message.match(pattern);
    if (matches && detectionType === 'none') {
      detectedPatterns.push(...matches.map(m => m.trim()));
      detectionType = 'email';
    }
  }

  if (context === 'message') {
    const emailWordPatterns = [
      /(?:mon|ma|ton|ta|votre|your|my)\s*(?:adresse\s*)?(?:e-?mail|mail|courriel)/gi,
      /(?:envoie|envoy[ée]|donne|partage|give|send|share)\s*(?:moi|me|ton|ta|votre|your|my)?\s*(?:adresse\s*)?(?:e-?mail|mail|courriel)/gi,
      /(?:contact|[ée]cri[st]|[ée]crire|write)\s*(?:moi|me)\s*(?:par|via|sur|at|on)?\s*(?:e-?mail|mail|courriel)?/gi,
    ];

    for (const pattern of emailWordPatterns) {
      const matches = normalizedMessage.match(pattern);
      if (matches && detectionType === 'none') {
        detectedPatterns.push(...matches);
        detectionType = 'email';
      }
    }
  }

  // URL: explicit links only (with protocol or www prefix)
  const urlPatterns = [
    /https?:\/\/[-a-z0-9@:%._+~#=]{1,256}\.[a-z]{2,6}\b[-a-z0-9@:%_+.~#?&/=]*/gi,
    /(?:www\.)[a-z0-9][-a-z0-9]*\.[a-z]{2,6}\b/gi,
  ];

  if (context === 'message') {
    urlPatterns.push(
      /[a-z0-9][-a-z0-9]*\.[a-z0-9][-a-z0-9]*\.[a-z]{2,6}\b/gi
    );
  }

  for (const pattern of urlPatterns) {
    const matches = message.match(pattern);
    if (matches && detectionType === 'none') {
      detectedPatterns.push(...matches.map(m => m.trim()));
      detectionType = 'url';
    }
  }

  // Address: only for messages (too many false positives in listing descriptions)
  if (context === 'message') {
    const addressPatterns = [
      /\d+\s+(?:rue|avenue|boulevard|place|chemin|impasse|all[ée]e)\s+[a-z\s]+/gi,
      /(?:rue|avenue|boulevard|place|chemin|impasse|all[ée]e)\s+[a-z\s]+\s*,?\s*\d{5}/gi,
      /\d{5}\s+[a-z]+/gi,
    ];

    for (const pattern of addressPatterns) {
      const matches = message.match(pattern);
      if (matches && detectionType === 'none') {
        detectedPatterns.push(...matches.map(m => m.trim()));
        detectionType = 'address';
      }
    }
  }

  // Social media: require explicit platform keyword as standalone word
  const socialMediaPatterns = [
    /\b(?:whatsapp|whats\s*app)\b/gi,
    /\bwa\.me\/[a-z0-9]+/gi,
    /\binstagram\b\s*:?\s*@[a-z0-9._]+/gi,
    /\binsta\s*[:@]\s*[a-z0-9._]+/gi,
    /\bfacebook\.com\/[a-z0-9._]+/gi,
    /\b(?:telegram|tg)\s*:\s*@?[a-z0-9._]+/gi,
    /\b(?:snapchat|snap)\s*:\s*@?[a-z0-9._]+/gi,
    /\btwitter\.com\/[a-z0-9._]+/gi,
    /\bx\.com\/[a-z0-9._]+/gi,
    /\b(?:tiktok|tik\s*tok)\b\s*:?\s*@[a-z0-9._]+/gi,
    /(?:^|\s)@[a-z0-9._]{3,}\b/gi,
  ];

  for (const pattern of socialMediaPatterns) {
    const matches = normalizedMessage.match(pattern);
    if (matches && detectionType === 'none') {
      detectedPatterns.push(...matches.map(m => m.trim()));
      detectionType = 'social_media';
    }
  }

  return {
    isBlocked: detectedPatterns.length > 0,
    detectionType,
    detectedPatterns: [...new Set(detectedPatterns)],
  };
}

export async function shouldAllowContactSharing(
  userId: string,
  recipientId: string,
  supabase: any
): Promise<boolean> {
  const { data: confirmedBookings, error } = await supabase
    .from('bookings')
    .select(`
      id,
      status,
      student_id,
      listing:listings!inner(landlord_id)
    `)
    .eq('status', 'confirmed');

  if (error) {
    console.error('Error checking booking status:', error);
    return false;
  }

  if (!confirmedBookings || confirmedBookings.length === 0) {
    return false;
  }

  const hasConfirmedBooking = confirmedBookings.some((booking: any) => {
    const landlordId = booking.listing?.landlord_id;
    const studentId = booking.student_id;

    return (
      (studentId === userId && landlordId === recipientId) ||
      (studentId === recipientId && landlordId === userId)
    );
  });

  return hasConfirmedBooking;
}

export function getDetectionTypeLabel(type: DetectionType, language: 'fr' | 'en' = 'fr'): string {
  const labels = {
    fr: {
      phone: 'Numéro de téléphone',
      email: 'Adresse email',
      url: 'URL / Lien web',
      address: 'Adresse postale',
      social_media: 'Réseau social',
      none: 'Aucun',
    },
    en: {
      phone: 'Phone number',
      email: 'Email address',
      url: 'URL / Web link',
      address: 'Postal address',
      social_media: 'Social media',
      none: 'None',
    },
  };

  return labels[language][type];
}

export function getDetectionTypeBadgeColor(type: DetectionType): string {
  const colors = {
    phone: 'bg-red-100 text-red-800 border-red-300',
    email: 'bg-orange-100 text-orange-800 border-orange-300',
    url: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    address: 'bg-purple-100 text-purple-800 border-purple-300',
    social_media: 'bg-pink-100 text-pink-800 border-pink-300',
    none: 'bg-gray-100 text-gray-800 border-gray-300',
  };

  return colors[type];
}
