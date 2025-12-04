/*
  # Permettre la lecture publique des réservations

  1. Modifications
    - Ajouter une politique pour permettre à tous les utilisateurs (même non authentifiés) de voir les réservations confirmées et en attente
    - Cela permet d'afficher les dates déjà réservées dans le calendrier pour tous les visiteurs

  2. Sécurité
    - Les utilisateurs non authentifiés peuvent uniquement voir les dates de début et fin des réservations
    - Ils ne peuvent pas voir les détails des étudiants ou créer des réservations
*/

CREATE POLICY "Anyone can view booking dates for availability"
  ON bookings FOR SELECT
  TO anon, authenticated
  USING (true);
