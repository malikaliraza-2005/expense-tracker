-- ─────────────────────────────────────────────────────────────
-- Migration 0001 — profiles
--
-- Phase 1 (Authentication). Introduces the `profiles` table: one row per
-- authenticated user, 1:1 with `auth.users`. This is the hub the rest of the
-- schema (Phase 2+) references. Includes Row Level Security (self read/update)
-- and a signup trigger that seeds a profile row for every new auth user.
--
-- See docs/database-design.md §2.1, §7, §8 and docs/phases/phase-1-authentication.md §5.
-- ─────────────────────────────────────────────────────────────

-- 1. Table ------------------------------------------------------------------
create table if not exists public.profiles (
  id                 uuid        primary key references auth.users (id) on delete cascade,
  full_name          text        not null default '',
  avatar_url         text,
  preferred_currency text        not null default 'USD',
  created_at         timestamptz not null default now()
);

comment on table public.profiles is 'One row per user, 1:1 with auth.users. Seeded by the signup trigger.';

-- 2. Row Level Security -----------------------------------------------------
-- Deny by default: enable RLS, then grant the minimum. A user may read and
-- update ONLY their own row. (Broader read access via shared groups/friends
-- is added in Phase 2 — Phase 1 deliberately keeps this self-only so the first
-- cross-user RLS check passes.)
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Note: no INSERT policy is granted to users. Rows are created exclusively by
-- the signup trigger below, which runs as `security definer`.

-- 3. Signup trigger ---------------------------------------------------------
-- On every new auth.users row, create the matching profile with a default
-- currency and an optional display name taken from signup metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, preferred_currency)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), ''),
    'USD'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
