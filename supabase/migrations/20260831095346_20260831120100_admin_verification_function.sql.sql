-- Phase 1b: Create SECURITY DEFINER function for admin verification updates
-- Admins update verification_status, verification_reviewed_at, verification_rejection_reason
-- These columns are revoked from authenticated, so admin needs a privileged function

CREATE OR REPLACE FUNCTION admin_update_verification_status(
  p_user_id uuid,
  p_status text,
  p_rejection_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Validate status value
  IF p_status NOT IN ('approved', 'rejected', 'pending', 'not_submitted') THEN
    RAISE EXCEPTION 'Invalid verification status';
  END IF;

  UPDATE profiles
  SET
    verification_status = p_status,
    verification_reviewed_at = now(),
    verification_rejection_reason = CASE
      WHEN p_status = 'rejected' THEN p_rejection_reason
      ELSE NULL
    END,
    is_verified = (p_status = 'approved')
  WHERE id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_update_verification_status FROM anon;
GRANT EXECUTE ON FUNCTION admin_update_verification_status TO authenticated;
