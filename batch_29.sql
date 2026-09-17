/*
# Revoke student booking update permission

## Context
Students should NOT be able to cancel or modify their own bookings directly.
Only landlords, managers, and admins can update booking status (e.g. confirm,
cancel). Students must contact hellofonty support to request a cancellation.

## Changes
- Drop the "Students can update own bookings" policy from the `bookings` table.
  This removes the ability for a student to UPDATE their own booking rows,
  preventing them from changing the status to 'cancelled' via the API even
  though the UI no longer exposes a cancel button.

## Security
- No new policies created.
- Existing UPDATE policies for landlords, managers, and admins remain intact.
- Students retain SELECT (view own bookings) and INSERT (create bookings) access.
*/

DROP POLICY IF EXISTS "Students can update own bookings" ON public.bookings;

/*
# Fix access guide RPC functions and security

## Context
Three bugs were found in the access guide system:
1. `get_my_access_guide` does not return `access_codes` — students never see
   the access codes (digicode, key box, etc.) that landlords fill in.
2. Both `get_my_access_guide` and `get_access_guide_by_token` are
   SECURITY DEFINER but have no `search_path` set — a search path injection risk.
3. `access_guide_unlock_overrides` grants full CRUD to the `anon` role
   unnecessarily — the RLS policies only allow authenticated landlords, so
   the anon grants are dead weight and a defense-in-depth concern.

## Changes
1. Recreate `get_my_access_guide(uuid)` with:
   - `access_codes jsonb` added to the return type and SELECT.
   - `SET search_path = public` for safety.
   - The `access_codes` field is gated by the same unlock condition as all
     other sensitive fields (payment completed + unlock date reached).
2. Recreate `get_access_guide_by_token(text)` with:
   - `SET search_path = public` for safety.
3. Revoke ALL privileges from `anon` on `access_guide_unlock_overrides`.

## Security
- Both functions remain SECURITY DEFINER with locked search_path.
- No RLS policy changes.
- anon role loses direct table access to `access_guide_unlock_overrides`
  (it was never usable anyway due to RLS).
*/

-- 1. Recreate get_my_access_guide with access_codes + search_path
DROP FUNCTION IF EXISTS public.get_my_access_guide(uuid);

CREATE FUNCTION public.get_my_access_guide(p_booking_id uuid)
RETURNS TABLE(
  listing_id uuid,
  listing_title text,
  listing_address text,
  listing_city text,
  start_date date,
  unlocked boolean,
  access_type text,
  access_instructions text,
  wifi_ssid text,
  wifi_password text,
  parking_info text,
  access_photos text[],
  access_video text,
  additional_info text,
  access_codes jsonb,
  unlock_date date,
  valid_until_date date,
  payment_status text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    l.id,
    l.title,
    l.address,
    l.city,
    b.start_date,
    (
      b.payment_status = 'completed'
      AND now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    ) AS unlocked,
    CASE WHEN
      b.payment_status = 'completed'
      AND now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.access_type END,
    CASE WHEN
      b.payment_status = 'completed'
      AND now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.access_instructions END,
    CASE WHEN
      b.payment_status = 'completed'
      AND now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.wifi_ssid END,
    CASE WHEN
      b.payment_status = 'completed'
      AND now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.wifi_password END,
    CASE WHEN
      b.payment_status = 'completed'
      AND now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.parking_info END,
    CASE WHEN
      b.payment_status = 'completed'
      AND now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.access_photos END,
    CASE WHEN
      b.payment_status = 'completed'
      AND now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.access_video END,
    CASE WHEN
      b.payment_status = 'completed'
      AND now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.additional_info END,
    CASE WHEN
      b.payment_status = 'completed'
      AND now() >= COALESCE(
        o.unlock_date::timestamptz,
        b.start_date::timestamptz - interval '24 hours'
      )
      AND (
        o.valid_until_date IS NULL
        OR now() < o.valid_until_date::timestamptz + interval '24 hours'
      )
    THEN ag.access_codes END,
    o.unlock_date,
    o.valid_until_date,
    b.payment_status
  FROM bookings b
  JOIN listings l ON l.id = b.listing_id
  LEFT JOIN access_guides ag ON ag.listing_id = b.listing_id
  LEFT JOIN access_guide_unlock_overrides o ON o.booking_id = b.id
  WHERE b.id = p_booking_id
    AND b.student_id = auth.uid()
    AND b.status = 'confirmed'
    AND b.end_date >= CURRENT_DATE
  LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_my_access_guide(uuid) TO authenticated;

-- 2. Recreate get_access_guide_by_token with search_path
DROP FUNCTION IF EXISTS public.get_access_guide_by_token(text);

CREATE FUNCTION public.get_access_guide_by_token(p_token text)
RETURNS TABLE (
  listing_id uuid,
  access_type text,
  access_instructions text,
  wifi_ssid text,
  wifi_password text,
  parking_info text,
  access_photos text[],
  access_video text,
  additional_info text,
  access_codes jsonb
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT ag.listing_id, ag.access_type, ag.access_instructions, ag.wifi_ssid,
         ag.wifi_password, ag.parking_info, ag.access_photos, ag.access_video,
         ag.additional_info, ag.access_codes
  FROM access_guides ag
  WHERE ag.share_token = p_token AND ag.share_token IS NOT NULL
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_access_guide_by_token(text) TO anon, authenticated;

-- 3. Revoke anon grants on access_guide_unlock_overrides
REVOKE ALL ON public.access_guide_unlock_overrides FROM anon;

-- Fix: subscriptions INSERT policy allowed any plan_type, including 'premium'
-- This is a privilege escalation - users could self-assign premium for free.
-- Restrict INSERT to plan_type = 'free' only. Premium is granted server-side
-- via Stripe webhook.

DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;

CREATE POLICY "Users can insert own free subscription"
  ON public.subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND plan_type = 'free');

/*
# Auto-create profile on user signup

## Problem
The client-side code calls `supabase.auth.signUp()` and then immediately
tries to `INSERT INTO profiles`. When email confirmation is enabled,
`signUp` does NOT create a session, so `auth.uid()` is null and the RLS
policy `auth.uid() = id` on the INSERT blocks the insert. The profile row
is never created, and the user ends up with an auth account but no profile.

## Solution
1. Pass user data (first_name, last_name, role, phone) via `user_metadata`
   in the `signUp` call.
2. This trigger fires `AFTER INSERT ON auth.users` and creates the profile
   row server-side, bypassing RLS (triggers run with the invoker's
   privileges, but the function is SECURITY DEFINER so it runs as the
   owner, bypassing RLS).

## Changes
- Create function `handle_new_user_profile()` that reads `raw_user_meta_data`
  from the new `auth.users` row and inserts a corresponding `profiles` row.
- Create trigger `on_auth_user_created` on `auth.users` AFTER INSERT.
- Both are idempotent (DROP IF EXISTS first).

## Security
- The function is SECURITY DEFINER so it can insert into `profiles`
  regardless of RLS. It only reads from `new` (the just-inserted auth row)
  and inserts a single profile row with the same `id`. No user-controlled
  data beyond the metadata they provided at signup is used.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role, phone, preferred_language, is_verified)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    new.raw_user_meta_data->>'phone',
    'fr',
    false
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

/*
# Automatic monthly landlord subscription charges via pg_cron

## Purpose
Schedules a monthly job that calls the `charge-landlord-subscriptions-cron`
edge function. This function iterates over all landlords with an active
Premium subscription, verifies they still have an active lease (end_date in
the future), and charges 59 EUR directly on their Stripe Connect account.
If the lease has ended, the subscription is automatically downgraded to free.

## Changes
1. Creates a PL/pgSQL function `charge_landlord_subscriptions()` that calls
   the edge function via `net.http_post` (pg_net extension).
2. Schedules it with `pg_cron` on the 1st of every month at 02:00 UTC.
3. Grants execution to the service role.

## Security
- The function runs with SECURITY DEFINER as the owner (postgres).
- It only makes an HTTP call to an internal edge function — no data is exposed.
*/

-- Ensure pg_net extension is available for HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.charge_landlord_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_function_url text;
  v_service_role_key text;
BEGIN
  v_function_url := current_setting('app.supabase_url', true) || '/functions/v1/charge-landlord-subscriptions-cron';
  v_service_role_key := current_setting('app.service_role_key', true);

  IF v_service_role_key IS NULL OR v_service_role_key = '' THEN
    RAISE NOTICE 'Service role key not configured, skipping subscription charges';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := '{}'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.charge_landlord_subscriptions() TO service_role;

-- Schedule the job on the 1st of every month at 02:00 UTC (idempotent)
DO $_$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'charge_landlord_subscriptions') THEN
    PERFORM cron.unschedule('charge_landlord_subscriptions');
  END IF;
  PERFORM cron.schedule(
    'charge_landlord_subscriptions',
    '0 2 1 * *',
    'SELECT public.charge_landlord_subscriptions();'
  );
END $_$;

