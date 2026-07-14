-- ─────────────────────────────────────────────────────────────
-- Migration 0008 — backfill profiles for pre-trigger auth users
--
-- The signup trigger `on_auth_user_created` (migration 0001) seeds a
-- `public.profiles` row for every NEW auth user. Any account created BEFORE
-- that trigger existed has an `auth.users` row but no matching `profiles` row.
--
-- Because every user-owned table references `profiles(id)` via a foreign key
-- (friendships.user_id, groups.created_by, expenses.created_by/paid_by, …), an
-- orphaned user cannot create anything — every INSERT fails with a foreign-key
-- violation (SQLSTATE 23503). This one-time, idempotent backfill closes that
-- gap for existing users; the trigger keeps future signups covered.
-- ─────────────────────────────────────────────────────────────

insert into public.profiles (id, full_name, preferred_currency)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), ''),
  'USD'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
