/*
  # Ajouter une politique d'insertion pour les notifications

  1. Modifications
    - Ajoute une politique INSERT pour permettre aux utilisateurs authentifiés de créer des notifications pour d'autres utilisateurs
    - Nécessaire pour que les étudiants puissent créer des notifications pour les propriétaires lors de l'annulation de demandes
  
  2. Sécurité
    - Permet uniquement aux utilisateurs authentifiés de créer des notifications
    - Les utilisateurs peuvent toujours uniquement voir et modifier leurs propres notifications
*/

-- Ajouter la politique INSERT pour les notifications
CREATE POLICY "Authenticated users can create notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);