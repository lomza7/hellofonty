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
