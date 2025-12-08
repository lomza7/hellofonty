/*
  # Create FAQ System

  1. New Tables
    - `faqs`
      - `id` (uuid, primary key)
      - `question_fr` (text) - Question en français
      - `question_en` (text) - Question en anglais
      - `answer_fr` (text) - Réponse en français
      - `answer_en` (text) - Réponse en anglais
      - `display_order` (integer) - Ordre d'affichage
      - `is_active` (boolean) - Actif/Inactif
      - `category` (text) - Catégorie (students, landlords, general)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `faqs` table
    - Add policy for anyone to read active FAQs
    - Add policy for admins to manage FAQs
*/

CREATE TABLE IF NOT EXISTS faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_fr text NOT NULL,
  question_en text NOT NULL,
  answer_fr text NOT NULL,
  answer_en text NOT NULL,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  category text DEFAULT 'general',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active FAQs"
  ON faqs
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can insert FAQs"
  ON faqs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update FAQs"
  ON faqs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete FAQs"
  ON faqs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insérer quelques FAQs par défaut
INSERT INTO faqs (question_fr, question_en, answer_fr, answer_en, display_order, category) VALUES
  (
    'Comment fonctionne HELLOFONTY ?',
    'How does HELLOFONTY work?',
    'HELLOFONTY est une plateforme qui connecte les étudiants d''INSEAD avec des propriétaires locaux à Fontainebleau. Les étudiants peuvent rechercher des logements vérifiés, envoyer des demandes de réservation, et signer des baux électroniques en toute sécurité.',
    'HELLOFONTY is a platform that connects INSEAD students with local landlords in Fontainebleau. Students can search for verified accommodations, send booking requests, and sign electronic leases securely.',
    1,
    'general'
  ),
  (
    'Comment puis-je réserver un logement ?',
    'How can I book accommodation?',
    'Créez un compte, recherchez des logements disponibles, consultez les détails et envoyez une demande de réservation au propriétaire. Une fois approuvée, vous pourrez procéder au paiement sécurisé.',
    'Create an account, search for available accommodations, review details and send a booking request to the landlord. Once approved, you can proceed with secure payment.',
    2,
    'students'
  ),
  (
    'Quels sont les frais de service ?',
    'What are the service fees?',
    'Les frais de service sont calculés lors du processus de réservation et incluent la sécurité de la plateforme, le système de paiement sécurisé, et la gestion des baux électroniques.',
    'Service fees are calculated during the booking process and include platform security, secure payment system, and electronic lease management.',
    3,
    'general'
  ),
  (
    'Comment synchroniser mon calendrier Airbnb/Booking.com ?',
    'How to sync my Airbnb/Booking.com calendar?',
    'Dans vos annonces, accédez à la section "Gestion du calendrier" et ajoutez les liens iCal de vos autres plateformes. Les réservations se synchroniseront automatiquement pour éviter les doubles réservations.',
    'In your listings, access the "Calendar Management" section and add iCal links from your other platforms. Reservations will automatically sync to avoid double bookings.',
    4,
    'landlords'
  ),
  (
    'Comment puis-je mettre mon logement en ligne ?',
    'How can I list my property?',
    'Créez un compte propriétaire, cliquez sur "Ajouter une annonce" et remplissez tous les détails de votre logement. Une fois publié, votre annonce sera visible par les étudiants.',
    'Create a landlord account, click "Add Listing" and fill in all your property details. Once published, your listing will be visible to students.',
    5,
    'landlords'
  ),
  (
    'Les paiements sont-ils sécurisés ?',
    'Are payments secure?',
    'Oui, tous les paiements sont traités via Stripe, un leader mondial du paiement en ligne. Vos informations bancaires sont cryptées et sécurisées.',
    'Yes, all payments are processed through Stripe, a global leader in online payments. Your banking information is encrypted and secure.',
    6,
    'general'
  );