/*
  # Ajout du type d'entité 'profile' aux tâches

  1. Modifications
    - Ajoute 'profile' aux valeurs autorisées pour related_entity_type dans la table tasks

  2. Notes
    - Nécessaire pour les tâches de vérification de profil (photo de profil)
*/

-- Supprimer l'ancienne contrainte
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_related_entity_type_check;

-- Ajouter la nouvelle contrainte avec 'profile' inclus
ALTER TABLE tasks ADD CONSTRAINT tasks_related_entity_type_check 
  CHECK (related_entity_type IN ('booking', 'message', 'listing', 'document', 'payment', 'lease', 'inventory', 'profile'));
