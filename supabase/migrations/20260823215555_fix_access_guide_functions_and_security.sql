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
