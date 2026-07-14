-- ─────────────────────────────────────────────────────────────
-- Migration 0007 — friend-by-email lookup
--
-- Phase 3 (Friends & Groups). Adding a friend requires resolving an email
-- address to an existing account, but `profiles` intentionally stores no email
-- (emails live in `auth.users`, which the app layer cannot read under RLS).
--
-- This SECURITY DEFINER function is the minimal, in-scope closure of that gap
-- (phase-3-friends-groups.md §5 — "add missing policies only if a gap
-- surfaces"). It is an identity-resolution helper, NOT balance/business logic,
-- so it does not conflict with the "keep logic in TypeScript" rule.
--
-- Safety:
--   • Returns ONLY a single profile id (uuid) — never the email, name, or any
--     other column — for an exact, case-insensitive match.
--   • Reveals only what "Add friend by email" must inherently reveal: whether a
--     given address has an account ("no account found" otherwise).
--   • Executable by authenticated users only; the service-role key is never used
--     on a user request path.
-- ─────────────────────────────────────────────────────────────

create or replace function public.find_profile_by_email(lookup_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(trim(lookup_email))
  limit 1;
$$;

comment on function public.find_profile_by_email(text) is
  'Resolve an email to a profile id via auth.users. Returns only the uuid for an exact, case-insensitive match, or null. Used by the addFriend action.';

revoke all on function public.find_profile_by_email(text) from public;
grant execute on function public.find_profile_by_email(text) to authenticated;
