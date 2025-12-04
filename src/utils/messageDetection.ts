export type DetectionType = 'phone' | 'email' | 'url' | 'address' | 'social_media' | 'none';

export interface DetectionResult {
  isBlocked: boolean;
  detectionType: DetectionType;
  detectedPatterns: string[];
}

export function detectProhibitedContent(message: string): DetectionResult {
  const detectedPatterns: string[] = [];
  let detectionType: DetectionType = 'none';

  const normalizedMessage = message.toLowerCase().replace(/\s+/g, ' ');

  const phonePatterns = [
    /(?:^|\s)(?:\+33|0033|0)\s*[67]\s*(?:\d\s*){8}(?:\s|$)/gi,
    /(?:^|\s)(?:\+33|0033|0)\s*[1-9]\s*(?:\d\s*){8}(?:\s|$)/gi,
    /(?:^|\s)\d{2}[\s.-]\d{2}[\s.-]\d{2}[\s.-]\d{2}[\s.-]\d{2}(?:\s|$)/gi,
    /(?:^|\s)(?:\+\d{1,3})?\s*\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{1,9}(?:\s|$)/gi,
  ];

  for (const pattern of phonePatterns) {
    const matches = message.match(pattern);
    if (matches) {
      detectedPatterns.push(...matches.map(m => m.trim()));
      detectionType = 'phone';
    }
  }

  const phoneWordPatterns = [
    /(?:zero|zéro|o)\s*(?:six|7|sept)/gi,
    /appel(?:le|ler|lez)?\s*(?:moi|me)/gi,
    /(?:mon|le|un|ton|votre|your|my)\s*(?:num[ée]ro|tel|t[ée]l[ée]phone|portable|mobile|number|phone)/gi,
    /(?:contact|joindre|appeler)\s*(?:moi|me)\s*(?:au|sur)/gi,
    /(?:give|send|share|envoie|envoy[ée]|donne|partage|prends?)\s*(?:me|moi|ton|votre|your|my)?\s*(?:num[ée]ro|tel|t[ée]l[ée]phone|portable|mobile|number|phone)/gi,
    /(?:take|get|grab|prends?|r[ée]cup[èe]re)\s*(?:my|mon|le)\s*(?:num[ée]ro|tel|t[ée]l[ée]phone|portable|mobile|number|phone)/gi,
    /(?:what|quel|c'est quoi)\s*(?:is|est)?\s*(?:your|ton|votre)\s*(?:num[ée]ro|tel|t[ée]l[ée]phone|portable|mobile|number|phone)/gi,
  ];

  for (const pattern of phoneWordPatterns) {
    const matches = normalizedMessage.match(pattern);
    if (matches) {
      detectedPatterns.push(...matches);
      detectionType = 'phone';
    }
  }

  const emailPatterns = [
    /[a-z0-9][-a-z0-9._+]*@[-a-z0-9]+(?:\.[-a-z0-9]+)*\.[a-z]{2,6}/gi,
    /[a-z0-9]+\s*(?:at|@|arobase|\[at\])\s*[a-z0-9]+\s*(?:dot|\.|point|\[dot\])\s*(?:com|fr|net|org|io|co)/gi,
    /[a-z0-9]+\s*(?:\(at\)|\[arobase\])\s*[a-z0-9]+/gi,
  ];

  for (const pattern of emailPatterns) {
    const matches = message.match(pattern);
    if (matches && detectionType === 'none') {
      detectedPatterns.push(...matches.map(m => m.trim()));
      detectionType = 'email';
    }
  }

  const emailWordPatterns = [
    /(?:mon|ma|ton|ta|votre|your|my)\s*(?:adresse\s*)?(?:e-?mail|mail|courriel)/gi,
    /(?:envoie|envoy[ée]|donne|partage|give|send|share)\s*(?:moi|me|ton|ta|votre|your|my)?\s*(?:adresse\s*)?(?:e-?mail|mail|courriel)/gi,
    /(?:contact|[ée]cri[st]|[ée]crire|write)\s*(?:moi|me)\s*(?:par|via|sur|at|on)?\s*(?:e-?mail|mail|courriel)?/gi,
    /(?:take|get|grab|prends?|r[ée]cup[èe]re)\s*(?:my|mon|ma)\s*(?:adresse\s*)?(?:e-?mail|mail|courriel)/gi,
    /(?:what|quel|c'est quoi)\s*(?:is|est)?\s*(?:your|ton|ta|votre)\s*(?:adresse\s*)?(?:e-?mail|mail|courriel)/gi,
  ];

  for (const pattern of emailWordPatterns) {
    const matches = normalizedMessage.match(pattern);
    if (matches && detectionType === 'none') {
      detectedPatterns.push(...matches);
      detectionType = 'email';
    }
  }

  const urlPatterns = [
    /(?:https?:\/\/)?(?:www\.)?[-a-z0-9@:%._+~#=]{1,256}\.[a-z]{2,6}\b(?:[-a-z0-9@:%_+.~#?&/=]*)/gi,
    /(?:www\.)[a-z0-9]+\.[a-z]{2,}/gi,
    /[a-z0-9][-a-z0-9]*\.[a-z0-9][-a-z0-9]*\.[a-z]{2,6}\b/gi,
  ];

  for (const pattern of urlPatterns) {
    const matches = message.match(pattern);
    if (matches && detectionType === 'none') {
      detectedPatterns.push(...matches.map(m => m.trim()));
      detectionType = 'url';
    }
  }

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

  const socialMediaPatterns = [
    /(?:whatsapp|whats\s*app|wa\.me)/gi,
    /(?:instagram|insta|ig)\s*:?\s*@?[a-z0-9._]+/gi,
    /(?:facebook|fb)(?:\.com)?(?:\/)?[a-z0-9._]+/gi,
    /(?:telegram|tg)\s*:?\s*@?[a-z0-9._]+/gi,
    /(?:snapchat|snap)\s*:?\s*@?[a-z0-9._]+/gi,
    /(?:twitter|x\.com)\s*:?\s*@?[a-z0-9._]+/gi,
    /(?:tiktok|tik\s*tok)\s*:?\s*@?[a-z0-9._]+/gi,
    /@[a-z0-9._]{3,}/gi,
  ];

  for (const pattern of socialMediaPatterns) {
    const matches = normalizedMessage.match(pattern);
    if (matches && detectionType === 'none') {
      detectedPatterns.push(...matches);
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
