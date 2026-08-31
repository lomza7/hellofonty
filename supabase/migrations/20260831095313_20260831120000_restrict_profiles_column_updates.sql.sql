-- Phase 1: Restrict profiles UPDATE columns
-- Users can only update their own non-sensitive columns directly.
-- Sensitive columns (role, is_verified, verification_*, stripe_*, subscription_exempt*) 
-- are only writable by admins (via their policy) or the service_role (webhooks/triggers).

-- Revoke broad UPDATE on profiles from authenticated
REVOKE UPDATE ON profiles FROM authenticated;

-- Grant UPDATE only on user-editable columns to authenticated
GRANT UPDATE (
  first_name,
  last_name,
  phone,
  avatar_url,
  preferred_language,
  preferred_lease_type,
  verification_document_url,
  verification_status,
  verification_submitted_at
) ON profiles TO authenticated;

-- Create a SECURITY DEFINER function for updating stripe_migration_needed
-- (called from Payouts.tsx by the landlord themselves)
CREATE OR REPLACE FUNCTION update_stripe_migration_needed(p_needed boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET stripe_migration_needed = p_needed WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION update_stripe_migration_needed FROM anon;
GRANT EXECUTE ON FUNCTION update_stripe_migration_needed TO authenticated;
