/*
  # Bucket Storage pour les Photos d'États des Lieux

  ## Description
  
  Création du bucket de stockage pour les photos d'états des lieux avec policies de sécurité appropriées.

  ## Bucket Créé
  
  ### inventory-photos
  - Stockage des photos prises lors des inspections d'états des lieux
  - Public en lecture pour les utilisateurs concernés
  - Upload restreint aux propriétaires pour leurs états des lieux
  - Suppression restreinte aux propriétaires pour les brouillons
  
  ## Policies de Sécurité
  
  - Les propriétaires peuvent uploader des photos pour leurs états des lieux en brouillon
  - Les utilisateurs concernés (propriétaire et locataire) peuvent voir les photos
  - Seuls les propriétaires peuvent supprimer les photos des brouillons
  - Les photos des états des lieux signés ne peuvent plus être supprimées
*/

-- Créer le bucket pour les photos d'états des lieux
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inventory-photos',
  'inventory-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Policy : Les propriétaires peuvent uploader des photos pour leurs états des lieux en brouillon
CREATE POLICY "Landlords can upload photos for draft inventories"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'inventory-photos' AND
    (storage.foldername(name))[1] IN (
      SELECT pi.id::text
      FROM property_inventories pi
      WHERE pi.landlord_id = auth.uid()
      AND pi.status = 'draft'
    )
  );

-- Policy : Les utilisateurs concernés peuvent voir les photos de leurs états des lieux
CREATE POLICY "Users can view photos of their inventories"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'inventory-photos' AND
    (storage.foldername(name))[1] IN (
      SELECT pi.id::text
      FROM property_inventories pi
      WHERE pi.landlord_id = auth.uid() OR pi.tenant_id = auth.uid()
    )
  );

-- Policy : Les propriétaires peuvent supprimer les photos de leurs brouillons
CREATE POLICY "Landlords can delete photos from draft inventories"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'inventory-photos' AND
    (storage.foldername(name))[1] IN (
      SELECT pi.id::text
      FROM property_inventories pi
      WHERE pi.landlord_id = auth.uid()
      AND pi.status = 'draft'
    )
  );

-- Policy : Les admins peuvent tout gérer
CREATE POLICY "Admins can manage all inventory photos"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'inventory-photos' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
