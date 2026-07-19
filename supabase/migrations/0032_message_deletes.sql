-- ─────────────────────────────────────────────────────────────
-- Migration 0032 — "Delete for me" and "Delete for everyone" for BOTH chat surfaces
--
-- Applies identically to per-expense chat (`messages`, 0017) and direct messages
-- (`dm_messages`, 0029). Both tables were deliberately immutable ("sent is sent"); this
-- migration adds the two delete semantics every messaging app has, without loosening the
-- append-only insert model:
--
--   • DELETE FOR EVERYONE — the SENDER retracts a message for all participants. The row
--     is SOFT-deleted: `deleted_at` is stamped and the body is overwritten with a
--     tombstone, so the original text is unrecoverable (that's the point) yet the row
--     stays in place, ordering is untouched, and the realtime UPDATE fans a "this
--     message was deleted" tombstone out to everyone. Done through a SECURITY DEFINER
--     RPC — NOT an UPDATE RLS policy — because only ONE controlled mutation is allowed
--     (stamp deleted_at + tombstone the body, sender-only, once). An open UPDATE policy
--     could never constrain WHICH columns or values a client writes.
--
--   • DELETE FOR ME — ANY participant hides a message from THEIR OWN view only. This is
--     per-user state, so it's a separate row in a `*_deletions` table (message_id,
--     user_id). It never mutates the message and never reaches anyone else. The read
--     queries filter these out; they persist across reloads and devices.
--
-- The message tables' existing SELECT/INSERT policies and the immutability of body-on-
-- insert are unchanged. There is still no client-facing UPDATE/DELETE policy on either
-- message table — every mutation continues to flow through a definer RPC (0018/0029's
-- rule), so nothing here becomes hand-craftable.
--
-- Additive and idempotent; apply by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────

-- ============================================================================
-- 1. Soft-delete marker on each message table
-- ============================================================================

alter table public.messages
  add column if not exists deleted_at timestamptz;
alter table public.dm_messages
  add column if not exists deleted_at timestamptz;

comment on column public.messages.deleted_at is
  'When set, this message was deleted FOR EVERYONE by its sender (0032). The body is '
  'overwritten with a tombstone at the same time, so the original text is gone. Clients '
  'render a "this message was deleted" placeholder. Null = a live message.';
comment on column public.dm_messages.deleted_at is
  'When set, this message was deleted FOR EVERYONE by its sender (0032). See '
  'public.messages.deleted_at.';

-- ============================================================================
-- 2. Per-user "delete for me" — one row per (message, user) that hides it
--
-- Deliberately separate tables rather than an array column: RLS then keeps a user's
-- hides to their own rows with a flat `user_id = auth.uid()`, and PostgREST can embed
-- them into the message read (RLS scopes the embed to the caller) so "is this hidden
-- for me?" is answered in the same round-trip.
-- ============================================================================

create table if not exists public.message_deletions (
  message_id uuid        not null references public.messages (id)   on delete cascade,
  user_id    uuid        not null references public.profiles (id)   on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists public.dm_message_deletions (
  message_id uuid        not null references public.dm_messages (id) on delete cascade,
  user_id    uuid        not null references public.profiles (id)    on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

comment on table public.message_deletions is
  'A per-user "delete for me" on a per-expense chat message: the (message, user) is '
  'hidden from THAT user''s view only. Never mutates the message, never seen by anyone '
  'else. Migration 0032.';
comment on table public.dm_message_deletions is
  'A per-user "delete for me" on a DM message. See public.message_deletions.';

alter table public.message_deletions    enable row level security;
alter table public.dm_message_deletions enable row level security;

-- Your own hides, nothing else. `user_id = auth.uid()` on both read and write is the
-- whole policy: a hide is personal, references only a message id (a random-uuid target
-- reveals nothing and hides nothing you can see), and is never exposed to the other
-- party. Insert is allowed directly (no definer RPC needed) precisely because the write
-- is confined to the caller's own rows and carries no authority over the message itself.
drop policy if exists message_deletions_select on public.message_deletions;
create policy message_deletions_select
  on public.message_deletions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists message_deletions_insert on public.message_deletions;
create policy message_deletions_insert
  on public.message_deletions for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists message_deletions_delete on public.message_deletions;
create policy message_deletions_delete
  on public.message_deletions for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists dm_message_deletions_select on public.dm_message_deletions;
create policy dm_message_deletions_select
  on public.dm_message_deletions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists dm_message_deletions_insert on public.dm_message_deletions;
create policy dm_message_deletions_insert
  on public.dm_message_deletions for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists dm_message_deletions_delete on public.dm_message_deletions;
create policy dm_message_deletions_delete
  on public.dm_message_deletions for delete to authenticated
  using (user_id = auth.uid());

-- ============================================================================
-- 3. "Delete for everyone" — SECURITY DEFINER, sender-only, one-shot
--
-- The only write path to `deleted_at`. Definer so it can UPDATE a table that has no
-- client UPDATE policy; the sender check (`sender_id = auth.uid()`) is enforced inside,
-- so it can never retract someone else's message. `deleted_at is null` makes it
-- idempotent — a second call changes nothing and returns false. The body is overwritten
-- in the SAME statement so the original text cannot survive the retraction.
-- ============================================================================

create or replace function public.delete_expense_message_for_everyone(p_message uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_changed integer;
begin
  if v_uid is null then
    return false;
  end if;

  update public.messages
    set deleted_at = now(),
        body       = 'This message was deleted'
    where id = p_message
      and sender_id = v_uid
      and deleted_at is null;

  get diagnostics v_changed = row_count;
  return v_changed > 0;
end;
$$;

comment on function public.delete_expense_message_for_everyone is
  'Retract a per-expense chat message for ALL participants — SENDER ONLY. Soft-deletes '
  '(stamps deleted_at) and overwrites the body with a tombstone in one statement. '
  'Idempotent; returns true only when a live message the caller sent was retracted. '
  'Migration 0032.';

revoke all on function public.delete_expense_message_for_everyone(uuid) from public;
revoke all on function public.delete_expense_message_for_everyone(uuid) from anon;
grant execute on function public.delete_expense_message_for_everyone(uuid) to authenticated;

create or replace function public.delete_dm_message_for_everyone(p_message uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_changed integer;
begin
  if v_uid is null then
    return false;
  end if;

  update public.dm_messages
    set deleted_at = now(),
        body       = 'This message was deleted'
    where id = p_message
      and sender_id = v_uid
      and deleted_at is null;

  get diagnostics v_changed = row_count;
  return v_changed > 0;
end;
$$;

comment on function public.delete_dm_message_for_everyone is
  'Retract a DM message for BOTH participants — SENDER ONLY. See '
  'public.delete_expense_message_for_everyone. Migration 0032.';

revoke all on function public.delete_dm_message_for_everyone(uuid) from public;
revoke all on function public.delete_dm_message_for_everyone(uuid) from anon;
grant execute on function public.delete_dm_message_for_everyone(uuid) to authenticated;

-- ============================================================================
-- 4. Realtime
--
-- `messages` (0017) and `dm_messages` (0029) are already in the supabase_realtime
-- publication for all operations, so the soft-delete UPDATE already fans out to every
-- subscriber that can SELECT the row (RLS unchanged). The thread clients add an UPDATE
-- handler that swaps in the tombstone live. The `*_deletions` tables are intentionally
-- NOT published — a "delete for me" is private and applied locally; other devices pick
-- it up on their next read. No REPLICA IDENTITY change is needed: an UPDATE's new-row
-- image (which carries deleted_at) is always logged in full.
-- ============================================================================
