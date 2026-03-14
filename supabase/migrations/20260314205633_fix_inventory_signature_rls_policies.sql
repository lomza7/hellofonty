/*
  # Fix inventory signature RLS policies

  ## Problem
  1. The UPDATE policy on property_inventories only allows updating when status='draft' AND requires
     the new status to also be 'draft' (WITH CHECK). This blocks the signing operation which sets status='signed'.
  2. The INSERT policy on inventory_signatures has no WITH CHECK clause.

  ## Changes
  - Drop and recreate the UPDATE policy to allow landlords to update their draft inventories
    and change status to 'signed' (removing the status constraint from WITH CHECK)
  - Fix the INSERT policy on inventory_signatures to add proper WITH CHECK
*/

-- Fix property_inventories UPDATE policy to allow signing (status change from draft to signed)
DROP POLICY IF EXISTS "Landlords can update own draft inventories" ON property_inventories;

CREATE POLICY "Landlords can update own inventories"
  ON property_inventories
  FOR UPDATE
  TO authenticated
  USING (landlord_id = auth.uid())
  WITH CHECK (landlord_id = auth.uid());

-- Fix inventory_signatures INSERT policy to add WITH CHECK
DROP POLICY IF EXISTS "Users can sign their inventories" ON inventory_signatures;

CREATE POLICY "Users can sign their inventories"
  ON inventory_signatures
  FOR INSERT
  TO authenticated
  WITH CHECK (
    signer_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM property_inventories
      WHERE property_inventories.id = inventory_signatures.inventory_id
        AND (property_inventories.landlord_id = auth.uid() OR property_inventories.tenant_id = auth.uid())
    )
  );
