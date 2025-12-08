/*
  # Création du système de gestion des tâches

  1. Nouvelle Table
    - `tasks`
      - `id` (uuid, clé primaire)
      - `user_id` (uuid, référence profiles) - L'utilisateur propriétaire de la tâche
      - `title` (text) - Titre de la tâche
      - `description` (text, optionnel) - Description détaillée
      - `priority` (text) - Priorité: 'urgent', 'important', 'normal'
      - `status` (text) - Statut: 'pending', 'completed', 'snoozed'
      - `task_type` (text) - Type: 'system', 'custom'
      - `related_entity_type` (text, optionnel) - Type d'entité liée: 'booking', 'message', 'listing', 'document', 'payment'
      - `related_entity_id` (uuid, optionnel) - ID de l'entité liée
      - `due_date` (timestamptz, optionnel) - Date limite
      - `snoozed_until` (timestamptz, optionnel) - Reporté jusqu'à
      - `completed_at` (timestamptz, optionnel) - Date de complétion
      - `created_at` (timestamptz) - Date de création
      - `updated_at` (timestamptz) - Date de mise à jour

  2. Sécurité
    - Enable RLS sur la table `tasks`
    - Les utilisateurs peuvent voir uniquement leurs propres tâches
    - Les utilisateurs peuvent créer, modifier et supprimer leurs propres tâches
    - Les admins peuvent voir toutes les tâches

  3. Index
    - Index sur user_id pour performance
    - Index sur status pour filtrage
    - Index sur due_date pour tri
*/

-- Créer la table tasks
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'important', 'normal')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'snoozed')),
  task_type text NOT NULL DEFAULT 'custom' CHECK (task_type IN ('system', 'custom')),
  related_entity_type text CHECK (related_entity_type IN ('booking', 'message', 'listing', 'document', 'payment', 'lease', 'inventory')),
  related_entity_id uuid,
  due_date timestamptz,
  snoozed_until timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Créer des index pour la performance
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_related_entity ON tasks(related_entity_type, related_entity_id);

-- Activer RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Politique: Les utilisateurs peuvent voir leurs propres tâches
CREATE POLICY "Users can view own tasks"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Politique: Les utilisateurs peuvent créer leurs propres tâches
CREATE POLICY "Users can create own tasks"
  ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Politique: Les utilisateurs peuvent modifier leurs propres tâches
CREATE POLICY "Users can update own tasks"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Politique: Les utilisateurs peuvent supprimer leurs propres tâches
CREATE POLICY "Users can delete own tasks"
  ON tasks
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Politique: Les admins peuvent voir toutes les tâches
CREATE POLICY "Admins can view all tasks"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_updated_at();

-- Activer Realtime pour les tâches
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;