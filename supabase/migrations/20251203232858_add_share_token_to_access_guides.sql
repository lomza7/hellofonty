/*
  # Ajout du token de partage pour les guides d'accès

  1. Modifications
    - Ajout de la colonne `share_token` à la table `access_guides`
      - Type: text unique
      - Permet de générer des liens partageables publics
      - Index pour améliorer les performances de recherche
    
  2. Sécurité
    - Politique publique en lecture pour les guides partagés via token
*/

-- Ajouter la colonne share_token
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'access_guides' AND column_name = 'share_token'
  ) THEN
    ALTER TABLE access_guides ADD COLUMN share_token text UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_access_guides_share_token ON access_guides(share_token);
  END IF;
END $$;

-- Politique pour permettre la lecture publique via token
CREATE POLICY "Anyone can view access guide with valid token"
  ON access_guides
  FOR SELECT
  USING (share_token IS NOT NULL);
