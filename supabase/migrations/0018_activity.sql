-- ─────────────────────────────────────────────────────────────
-- Migration 0018 — Activity feed (Phase 1 of the realtime/activity work)
--
-- A per-user, append-only activity feed. Each row belongs to ONE user's feed
-- (`owner_id` = whose feed) and records something that happened involving them:
-- an expense they were added to, a group change, a settlement, a friend add, etc.
--
-- Cross-account by design: when User A acts (e.g. adds User B to an expense), A's
-- action writes an event to BOTH A's feed ("You added …") and B's feed ("A added
-- you …"). Since RLS is per-feed (`owner_id = auth.uid()`), the only write path is
-- the SECURITY DEFINER `log_activity` RPC, which pins the actor to auth.uid() and
-- only lets you write to your own feed or a *connected* account's feed (someone you
-- share a linked member with). Display strings (`actor_name`, `subject`) are
-- denormalized at write time so the feed reads with no cross-account joins.
--
-- "Who owes whom" balances are NOT stored here — they are derived on read from the
-- balance engine. Only discrete happened-once events live in this table.
--
-- Apply by hand in the Supabase SQL editor. Additive; nothing else changes.
-- (Numbered 0018 because Activity is built before the settlement change; Doc 2's
-- `settlements.expense_id` will take a later number.)
-- ─────────────────────────────────────────────────────────────

create table if not exists public.activity_events (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  type         text not null check (type in (
                 'expense_created', 'expense_added_you', 'expense_updated', 'expense_deleted',
                 'group_created', 'group_added_you', 'group_removed_you', 'group_left',
                 'settlement_recorded', 'settlement_received',
                 'friend_added', 'friend_removed',
                 'balance_changed')),
  actor_id     uuid references public.profiles(id) on delete set null,
  -- Denormalized so a recipient can render the feed without reading the actor's
  -- profile (which RLS may hide).
  actor_name   text,
  -- Denormalized subject label (expense title / group name / person name). Kept so
  -- the event survives deletion of the entity it refers to.
  subject      text,
  -- Soft links to the entity — SET NULL on delete so history is never erased.
  expense_id   uuid references public.expenses(id) on delete set null,
  group_id     uuid references public.groups(id) on delete set null,
  member_id    uuid references public.members(id) on delete set null,
  amount_cents int,
  currency     text,
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);

create index if not exists idx_activity_owner_created
  on public.activity_events (owner_id, created_at desc);

comment on table public.activity_events is
  'Per-user activity feed (owner_id = whose feed). Append-only; display strings '
  'denormalized. Written only via log_activity(); "who owes whom" is derived, not stored.';

alter table public.activity_events enable row level security;

-- A user reads and updates (marks read) only their OWN feed. There is no INSERT
-- policy — all writes go through the SECURITY DEFINER log_activity() below, which is
-- the single, guarded write path.
drop policy if exists activity_select_own on public.activity_events;
create policy activity_select_own on public.activity_events
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists activity_update_own on public.activity_events;
create policy activity_update_own on public.activity_events
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ============================================================================
-- log_activity(events) — the single, guarded write path
--
-- Inserts one row per element of `p_events` (a JSON array). Each element:
--   { owner_id, type, subject?, expense_id?, group_id?, member_id?, amount_cents?,
--     currency? }
-- The caller is pinned as `actor_id = auth.uid()` and `actor_name` is looked up
-- once. A caller may only write to their OWN feed or to the feed of a *connected*
-- account (they share a linked member either direction) — so an event can't be
-- injected into an unrelated user's feed. Returns the number of rows inserted.
-- SECURITY DEFINER because it writes to other users' feeds (owner-scoped RLS forbids
-- that directly); the connection check is the authorization guard.
-- ============================================================================
create or replace function public.log_activity(p_events jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_name  text;
  v_event jsonb;
  v_owner uuid;
  v_count int := 0;
begin
  if v_uid is null or p_events is null then
    return 0;
  end if;
  select full_name into v_name from public.profiles where id = v_uid;

  for v_event in select * from jsonb_array_elements(p_events) loop
    v_owner := nullif(v_event->>'owner_id', '')::uuid;
    if v_owner is null then
      continue;
    end if;
    -- own feed, or a connected account's feed (shared linked member either way)
    if v_owner <> v_uid and not exists (
      select 1 from public.members m
      where (m.owner_id = v_uid   and m.linked_user_id = v_owner)
         or (m.owner_id = v_owner and m.linked_user_id = v_uid)
    ) then
      continue;
    end if;

    insert into public.activity_events (
      owner_id, type, actor_id, actor_name, subject,
      expense_id, group_id, member_id, amount_cents, currency)
    values (
      v_owner,
      v_event->>'type',
      v_uid,
      v_name,
      nullif(v_event->>'subject', ''),
      nullif(v_event->>'expense_id', '')::uuid,
      nullif(v_event->>'group_id', '')::uuid,
      nullif(v_event->>'member_id', '')::uuid,
      nullif(v_event->>'amount_cents', '')::int,
      nullif(v_event->>'currency', ''));
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.log_activity is
  'Append activity events (JSON array) to feeds. Pins actor_id = auth.uid(); a caller '
  'may only write to their own feed or a connected account''s feed. Returns count.';

grant execute on function public.log_activity(jsonb) to authenticated;

-- ============================================================================
-- Realtime — the feed updates live (Phase 2 subscribes to this).
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'activity_events'
  ) then
    alter publication supabase_realtime add table public.activity_events;
  end if;
end;
$$;
