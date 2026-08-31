-- Revoke PUBLIC execute on the two new functions
REVOKE EXECUTE ON FUNCTION admin_update_verification_status FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION update_stripe_migration_needed FROM PUBLIC;

-- Re-grant to authenticated (the REVOKE FROM PUBLIC removed it from authenticated too)
GRANT EXECUTE ON FUNCTION admin_update_verification_status TO authenticated;
GRANT EXECUTE ON FUNCTION update_stripe_migration_needed TO authenticated;
