/*
  # Ajout de la caution aux annonces

  1. Modifications
    - Ajout d'une colonne `security_deposit` à la table `listings`
      - Type: numeric (pour stocker des montants en euros)
      - Nullable: oui (optionnel)
      - Description: Montant de la caution/garantie demandée par le propriétaire

  2. Sécurité
    - Pas de changement RLS nécessaire (hérite des règles existantes)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'security_deposit'
  ) THEN
    ALTER TABLE listings ADD COLUMN security_deposit numeric;
  END IF;
END $$;