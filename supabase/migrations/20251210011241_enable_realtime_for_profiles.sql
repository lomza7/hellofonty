/*
  # Activer le realtime pour la table profiles

  1. Changements
    - Active la réplication realtime pour la table `profiles`
    - Permet aux clients de recevoir les mises à jour en temps réel
  
  2. Notes
    - Nécessaire pour que le dashboard se mette à jour automatiquement
    - Les utilisateurs verront leurs changements de profil instantanément
*/

ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
