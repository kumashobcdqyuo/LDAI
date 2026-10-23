/*
# Revoke EXECUTE on handle_new_user from anon and authenticated

## Overview
The `handle_new_user()` SECURITY DEFINER function is a trigger function that
auto-creates a profile row when a new auth user signs up. It should only be
called by the database trigger, never via the REST API. The security advisor
flagged it as callable by anon and authenticated roles.

## Security Changes
- REVOKE EXECUTE on `public.handle_new_user()` from `anon` and `authenticated`.
- The trigger still works because it runs with the function owner's privileges.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
