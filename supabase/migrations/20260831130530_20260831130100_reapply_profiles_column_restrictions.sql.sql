-- Re-apply the column-level UPDATE restriction on profiles
-- The GRANT ALL restored UPDATE on all columns, which we need to restrict again

-- Revoke the broad UPDATE grant on profiles
REVOKE UPDATE ON profiles FROM authenticated;

-- Re-grant UPDATE only on user-editable columns
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
