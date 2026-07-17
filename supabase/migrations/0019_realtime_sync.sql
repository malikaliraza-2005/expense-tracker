-- ─────────────────────────────────────────────────────────────
-- Migration 0019 — real-time sync foundation + member integrity
--
-- Two foundational concerns for the realtime/activity work:
--
--   1. Realtime publication. For the app-wide live sync (a change in one account
--      reflecting instantly in every affected account), the sync-relevant tables must
--      be in the `supabase_realtime` publication so `postgres_changes` streams their
--      INSERT/UPDATE/DELETE. RLS still governs which rows each subscriber receives, so
--      a user is only ever refreshed for data they can already see (their own + what
--      0015 cross-user visibility exposes). `messages` and `activity_events` were added
--      by 0017/0018; this adds the rest.
--
--   2. Self-member integrity. The owner's self-member ("You") must be unique per owner
--      and present in every group they own — otherwise it can render twice (once in a
--      group's manage-chips, once in the member cards). We enforce one self-member per
--      owner, make ensure_self_member race-safe, and backfill the owner into every
--      existing group.
--
-- Additive and idempotent; apply by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────

-- ============================================================================
-- 1. Realtime publication — stream changes for the sync-relevant tables
-- ============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'expenses', 'expense_splits', 'settlements',
    'groups', 'group_members', 'members', 'invitations'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- ============================================================================
-- 2. One self-member per owner — prevents a duplicate "You"
--
-- A partial unique index: at most one is_self member per owner. (Safe to create —
-- no owner currently has more than one.)
-- ============================================================================
create unique index if not exists members_one_self_per_owner
  on public.members (owner_id)
  where is_self;

-- ============================================================================
-- 3. ensure_self_member — make it race-safe against the new unique index
--
-- Same contract (return the caller's self-member id, creating it on first call), but
-- the insert now tolerates a concurrent creator via ON CONFLICT so two simultaneous
-- calls can never error or create a duplicate.
-- ============================================================================
create or replace function public.ensure_self_member()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_name text;
begin
  if auth.uid() is null then
    return null;
  end if;

  select id into v_id
  from public.members
  where owner_id = auth.uid() and is_self
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  select coalesce(nullif(btrim(full_name), ''), 'You') into v_name
  from public.profiles where id = auth.uid();

  insert into public.members (owner_id, name, is_self)
  values (auth.uid(), coalesce(v_name, 'You'), true)
  on conflict (owner_id) where is_self do nothing;

  -- Re-read: returns the row we inserted, or the one a concurrent call created.
  select id into v_id
  from public.members
  where owner_id = auth.uid() and is_self
  limit 1;
  return v_id;
end;
$$;

comment on function public.ensure_self_member is
  'Returns the caller''s self-member id, creating it on first call. Race-safe via the '
  'one-self-member-per-owner unique index (ON CONFLICT).';

-- ============================================================================
-- 4. Backfill — the owner is a member of every group they own
--
-- The owner always participates in their own groups; ensure their self-member has a
-- group_members row in each, so they appear (once) on the Members tab and in group
-- balances. Idempotent via the (group_id, member_id) unique constraint.
-- ============================================================================
insert into public.group_members (group_id, member_id)
select g.id, m.id
from public.groups g
join public.members m on m.owner_id = g.owner_id and m.is_self
on conflict (group_id, member_id) do nothing;
