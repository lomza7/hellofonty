-- Revoke all privileges from anon role on access_guides
-- Public access is handled by the RPC function get_access_guide_by_token (SECURITY DEFINER)
REVOKE ALL ON public.access_guides FROM anon;
