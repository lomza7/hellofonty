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
