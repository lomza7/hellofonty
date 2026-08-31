-- Restore table-level grants that were accidentally removed by REVOKE statements
-- The RLS policies already control row-level access; these grants just allow
-- authenticated/anon to use the tables at all.

-- 1. Grant ALL privileges to authenticated on all tables in public schema
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;

-- 2. Grant SELECT to anon on public-facing tables (read-only public content)
GRANT SELECT ON listings TO anon;
GRANT SELECT ON listing_images TO anon;
GRANT SELECT ON listing_statistics TO anon;
GRANT SELECT ON blog_posts TO anon;
GRANT SELECT ON blog_categories TO anon;
GRANT SELECT ON blog_tags TO anon;
GRANT SELECT ON blog_post_tags TO anon;
GRANT SELECT ON faqs TO anon;
GRANT SELECT ON pricing_plans TO anon;
GRANT SELECT ON partner_offers TO anon;
GRANT SELECT ON feature_carousel_images TO anon;
GRANT SELECT ON agency_comparison_features TO anon;
GRANT SELECT ON comparison_items TO anon;
GRANT SELECT ON platform_settings TO anon;
GRANT SELECT ON public_profiles TO anon;
GRANT SELECT ON public_bookings TO anon;

-- 3. Add a policy so authenticated users can view landlord profiles
-- (needed for search, listing detail, favorites, payments, deposits, etc.)
CREATE POLICY "Authenticated users can view landlord profiles" ON profiles
  FOR SELECT TO authenticated
  USING (role = 'landlord');
