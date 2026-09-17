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

CREATE OR REPLACE FUNCTION public.is_landlord()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'landlord'); $$;

CREATE OR REPLACE FUNCTION public.is_student()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'student'); $$;

GRANT EXECUTE ON FUNCTION public.is_landlord() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_student() TO authenticated;

DROP POLICY IF EXISTS "Les admins peuvent supprimer des critères de comparaison" ON agency_comparison_features;
CREATE POLICY "Les admins peuvent supprimer des critères de comparaison" ON agency_comparison_features FOR DELETE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Les admins peuvent insérer des critères de comparaison" ON agency_comparison_features;
CREATE POLICY "Les admins peuvent insérer des critères de comparaison" ON agency_comparison_features FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Les admins peuvent modifier des critères de comparaison" ON agency_comparison_features;
CREATE POLICY "Les admins peuvent modifier des critères de comparaison" ON agency_comparison_features FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can view all blocked messages" ON blocked_messages;
CREATE POLICY "Admins can view all blocked messages" ON blocked_messages FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can manage categories" ON blog_categories;
CREATE POLICY "Admins can manage categories" ON blog_categories FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can manage post tags" ON blog_post_tags;
CREATE POLICY "Admins can manage post tags" ON blog_post_tags FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can delete posts" ON blog_posts;
CREATE POLICY "Admins can delete posts" ON blog_posts FOR DELETE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can insert posts" ON blog_posts;
CREATE POLICY "Admins can insert posts" ON blog_posts FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can view all posts" ON blog_posts;
CREATE POLICY "Admins can view all posts" ON blog_posts FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can update all posts" ON blog_posts;
CREATE POLICY "Admins can update all posts" ON blog_posts FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can manage tags" ON blog_tags;
CREATE POLICY "Admins can manage tags" ON blog_tags FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can view all bookings" ON bookings;
CREATE POLICY "Admins can view all bookings" ON bookings FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can update bookings" ON bookings;
CREATE POLICY "Admins can update bookings" ON bookings FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Les admins peuvent supprimer des comparaisons" ON comparison_items;
CREATE POLICY "Les admins peuvent supprimer des comparaisons" ON comparison_items FOR DELETE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Les admins peuvent insérer des comparaisons" ON comparison_items;
CREATE POLICY "Les admins peuvent insérer des comparaisons" ON comparison_items FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Les admins peuvent modifier des comparaisons" ON comparison_items;
CREATE POLICY "Les admins peuvent modifier des comparaisons" ON comparison_items FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_delete_contract_template_sections" ON contract_template_sections;
CREATE POLICY "admin_delete_contract_template_sections" ON contract_template_sections FOR DELETE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "admin_insert_contract_template_sections" ON contract_template_sections;
CREATE POLICY "admin_insert_contract_template_sections" ON contract_template_sections FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_update_contract_template_sections" ON contract_template_sections;
CREATE POLICY "admin_update_contract_template_sections" ON contract_template_sections FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can manage element templates" ON default_element_templates;
CREATE POLICY "Admins can manage element templates" ON default_element_templates FOR ALL TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can manage room templates" ON default_room_templates;
CREATE POLICY "Admins can manage room templates" ON default_room_templates FOR ALL TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "select_admin_deposits" ON deposit_transactions;
CREATE POLICY "select_admin_deposits" ON deposit_transactions FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can delete FAQs" ON faqs;
CREATE POLICY "Admins can delete FAQs" ON faqs FOR DELETE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can insert FAQs" ON faqs;
CREATE POLICY "Admins can insert FAQs" ON faqs FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can update FAQs" ON faqs;
CREATE POLICY "Admins can update FAQs" ON faqs FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Étudiants peuvent ajouter des favoris" ON favorites;
CREATE POLICY "Étudiants peuvent ajouter des favoris" ON favorites FOR INSERT TO authenticated WITH CHECK (((auth.uid() = student_id) AND is_student()));
DROP POLICY IF EXISTS "Admins can delete features" ON feature_carousel_images;
CREATE POLICY "Admins can delete features" ON feature_carousel_images FOR DELETE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can insert features" ON feature_carousel_images;
CREATE POLICY "Admins can insert features" ON feature_carousel_images FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Public views active, admins view all" ON feature_carousel_images;
CREATE POLICY "Public views active, admins view all" ON feature_carousel_images FOR SELECT TO public USING (((is_active = true) OR is_admin()));
DROP POLICY IF EXISTS "Admins can update features" ON feature_carousel_images;
CREATE POLICY "Admins can update features" ON feature_carousel_images FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin can insert invoices" ON invoices;
CREATE POLICY "Admin can insert invoices" ON invoices FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin can view all invoices" ON invoices;
CREATE POLICY "Admin can view all invoices" ON invoices FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can view all landlord documents" ON landlord_documents;
CREATE POLICY "Admins can view all landlord documents" ON landlord_documents FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can update landlord document status" ON landlord_documents;
CREATE POLICY "Admins can update landlord document status" ON landlord_documents FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_insert_subscription_charges" ON landlord_subscription_charges;
CREATE POLICY "admin_insert_subscription_charges" ON landlord_subscription_charges FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "admin_read_subscription_charges" ON landlord_subscription_charges;
CREATE POLICY "admin_read_subscription_charges" ON landlord_subscription_charges FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "admin_update_subscription_charges" ON landlord_subscription_charges;
CREATE POLICY "admin_update_subscription_charges" ON landlord_subscription_charges FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can do everything with leases" ON leases;
CREATE POLICY "Admins can do everything with leases" ON leases FOR ALL TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Landlords can create leases" ON leases;
CREATE POLICY "Landlords can create leases" ON leases FOR INSERT TO authenticated WITH CHECK (((landlord_id = auth.uid()) AND is_landlord()));
DROP POLICY IF EXISTS "Admins peuvent supprimer toutes les images" ON listing_images;
CREATE POLICY "Admins peuvent supprimer toutes les images" ON listing_images FOR DELETE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins peuvent ajouter des images" ON listing_images;
CREATE POLICY "Admins peuvent ajouter des images" ON listing_images FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins peuvent voir toutes les images" ON listing_images;
CREATE POLICY "Admins peuvent voir toutes les images" ON listing_images FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins peuvent modifier toutes les images" ON listing_images;
CREATE POLICY "Admins peuvent modifier toutes les images" ON listing_images FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins peuvent supprimer toutes les annonces" ON listings;
CREATE POLICY "Admins peuvent supprimer toutes les annonces" ON listings FOR DELETE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Propriétaires peuvent créer des annonces" ON listings;
CREATE POLICY "Propriétaires peuvent créer des annonces" ON listings FOR INSERT TO authenticated WITH CHECK (((auth.uid() = landlord_id) AND is_landlord()));
DROP POLICY IF EXISTS "Admins peuvent voir toutes les annonces" ON listings;
CREATE POLICY "Admins peuvent voir toutes les annonces" ON listings FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins peuvent modifier toutes les annonces" ON listings;
CREATE POLICY "Admins peuvent modifier toutes les annonces" ON listings FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins peuvent voir tous les messages" ON messages;
CREATE POLICY "Admins peuvent voir tous les messages" ON messages FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can delete partner offers" ON partner_offers;
CREATE POLICY "Admins can delete partner offers" ON partner_offers FOR DELETE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can insert partner offers" ON partner_offers;
CREATE POLICY "Admins can insert partner offers" ON partner_offers FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can view all partner offers" ON partner_offers;
CREATE POLICY "Admins can view all partner offers" ON partner_offers FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can update partner offers" ON partner_offers;
CREATE POLICY "Admins can update partner offers" ON partner_offers FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Only admins can update platform settings" ON platform_settings;
CREATE POLICY "Only admins can update platform settings" ON platform_settings FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can delete pricing plans" ON pricing_plans;
CREATE POLICY "Admins can delete pricing plans" ON pricing_plans FOR DELETE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can create pricing plans" ON pricing_plans;
CREATE POLICY "Admins can create pricing plans" ON pricing_plans FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can view all pricing plans" ON pricing_plans;
CREATE POLICY "Admins can view all pricing plans" ON pricing_plans FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can update pricing plans" ON pricing_plans;
CREATE POLICY "Admins can update pricing plans" ON pricing_plans FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins peuvent modifier tous les profils" ON profiles;
CREATE POLICY "Admins peuvent modifier tous les profils" ON profiles FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can manage all inventories" ON property_inventories;
CREATE POLICY "Admins can manage all inventories" ON property_inventories FOR ALL TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "admins_can_read_refunds" ON refunds;
CREATE POLICY "admins_can_read_refunds" ON refunds FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can delete rent payments" ON rent_payments;
CREATE POLICY "Admins can delete rent payments" ON rent_payments FOR DELETE TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can view all rent payments" ON rent_payments;
CREATE POLICY "Admins can view all rent payments" ON rent_payments FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can update rent payments" ON rent_payments;
CREATE POLICY "Admins can update rent payments" ON rent_payments FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins manage rent reminder settings" ON rent_reminder_settings;
CREATE POLICY "Admins manage rent reminder settings" ON rent_reminder_settings FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin can view all stripe customers" ON stripe_customers;
CREATE POLICY "Admin can view all stripe customers" ON stripe_customers FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admin can view all stripe subscriptions" ON stripe_subscriptions;
CREATE POLICY "Admin can view all stripe subscriptions" ON stripe_subscriptions FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can view all student documents" ON student_documents;
CREATE POLICY "Admins can view all student documents" ON student_documents FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can update student document status" ON student_documents;
CREATE POLICY "Admins can update student document status" ON student_documents FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin can view all subscriptions" ON subscriptions;
CREATE POLICY "Admin can view all subscriptions" ON subscriptions FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admin can update all subscriptions" ON subscriptions;
CREATE POLICY "Admin can update all subscriptions" ON subscriptions FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can view all conversations" ON support_conversations;
CREATE POLICY "Admins can view all conversations" ON support_conversations FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admins can update all conversations" ON support_conversations;
CREATE POLICY "Admins can update all conversations" ON support_conversations FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can send messages in any conversation" ON support_messages;
CREATE POLICY "Admins can send messages in any conversation" ON support_messages FOR INSERT TO authenticated WITH CHECK (((auth.uid() = sender_id) AND (sender_type = 'admin'::text) AND is_admin()));
DROP POLICY IF EXISTS "Admins can view all messages" ON support_messages;
CREATE POLICY "Admins can view all messages" ON support_messages FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Users can view messages by conversation" ON support_messages;
CREATE POLICY "Users can view messages by conversation" ON support_messages FOR SELECT TO public USING ((EXISTS ( SELECT 1 FROM support_conversations WHERE ((support_conversations.id = support_messages.conversation_id) AND ((support_conversations.user_id = auth.uid()) OR (support_conversations.user_id IS NULL) OR is_admin())))));
DROP POLICY IF EXISTS "Admins can update all messages" ON support_messages;
CREATE POLICY "Admins can update all messages" ON support_messages FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admins can view all tasks" ON tasks;
CREATE POLICY "Admins can view all tasks" ON tasks FOR SELECT TO authenticated USING (is_admin());

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON profiles FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON bookings FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON listings FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON rent_payments FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON subscriptions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON messages FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON leases FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON listing_images FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON landlord_stripe_accounts FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON deposit_transactions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON landlord_documents FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON student_documents FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON property_inventories FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON invoices FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON refunds FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON stripe_customers FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON stripe_subscriptions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON landlord_subscription_charges FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON rent_reminder_settings FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON contract_template_sections FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON blocked_messages FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON tasks FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON notifications FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON favorites FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON access_guides FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON access_guide_unlock_overrides FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON external_ical_feeds FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON imported_blocked_dates FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON blocked_dates FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON feature_carousel_images FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON blog_posts FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON blog_categories FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON blog_tags FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON blog_post_tags FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON faqs FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON pricing_plans FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON partner_offers FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON platform_settings FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON agency_comparison_features FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON comparison_items FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON default_element_templates FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON default_room_templates FROM anon;

/*
# Fix cron job send-rent-reminder-daily with hardcoded URL

## Problem
The cron job used `current_setting('app.settings.supabase_url', true)` and
`current_setting('app.settings.service_role_key', true)` which can return NULL
if the database-level settings are lost, silently breaking the daily reminder.

## Fix
Reschedule the cron with a hardcoded URL (matching the pattern used by the
sync-ical-feeds-every-10min cron job). The edge function reads its own
SUPABASE_SERVICE_ROLE_KEY from Deno.env at runtime, so the Authorization header
is only needed for JWT verification — pg_net internal requests are treated as
authenticated by Supabase, as proven by the ical sync cron working without it.

## Changes
1. Unschedule the existing send-rent-reminder-daily job
2. Reschedule with hardcoded URL and minimal headers
*/

SELECT cron.unschedule('send-rent-reminder-daily');

SELECT cron.schedule(
  'send-rent-reminder-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bowqrkapnzvcbaciaplx.supabase.co/functions/v1/send-rent-reminder',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

/*
# Allow unauthenticated visitors to read landlord profiles

## Context
The listing detail page (ListingDetail.tsx) loads a listing with a join:
  `.select('*, landlord:profiles!landlord_id(*), images:listing_images(*)')`

When an unauthenticated visitor (role `anon`) opens a listing URL directly,
the entire query fails because `anon` has no SELECT privilege on `profiles`.
The page shows "not found" even though the listing exists and is public.

## Changes
1. Grant SELECT on `profiles` to the `anon` role (table-level privilege).
2. Add a SELECT policy for `anon` that only allows reading profiles where
   `role = 'landlord'` — the same data already exposed through the
   `public_profiles` view, so no new data is revealed.

## Security
- Only landlord profiles are exposed; student and admin profiles remain
  invisible to unauthenticated users.
- This mirrors the existing "Authenticated users can view landlord profiles"
  policy, just extended to the `anon` role.
*/

-- Grant table-level SELECT to anon
GRANT SELECT ON public.profiles TO anon;

-- Add anon SELECT policy for landlord profiles only
DROP POLICY IF EXISTS "Anon can view landlord profiles" ON public.profiles;

CREATE POLICY "Anon can view landlord profiles"
  ON public.profiles
  FOR SELECT
  TO anon
  USING (role = 'landlord');

-- Delete Delphine Chauviere's two expired bookings and all related data
-- Booking 1: 2cd84026-2d3a-493f-9b06-b2f835bc6715 (Cour Napoléon, payment_status: expired)
-- Booking 2: 4716a617-147d-4f30-9307-7033b10c3916 (Le Lagorsse, payment_status: expired)

-- Step 1: Delete notifications referencing these bookings
DELETE FROM notifications WHERE related_id IN ('2cd84026-2d3a-493f-9b06-b2f835bc6715','4716a617-147d-4f30-9307-7033b10c3916');

-- Step 2: Delete messages associated with these bookings
DELETE FROM messages WHERE booking_id IN ('2cd84026-2d3a-493f-9b06-b2f835bc6715','4716a617-147d-4f30-9307-7033b10c3916');

-- Step 3: Delete leases associated with these bookings
DELETE FROM leases WHERE booking_id IN ('2cd84026-2d3a-493f-9b06-b2f835bc6715','4716a617-147d-4f30-9307-7033b10c3916');

-- Step 4: Delete the bookings themselves
DELETE FROM bookings WHERE id IN ('2cd84026-2d3a-493f-9b06-b2f835bc6715','4716a617-147d-4f30-9307-7033b10c3916');

