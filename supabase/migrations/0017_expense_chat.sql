-- ─────────────────────────────────────────────────────────────
-- Migration 0017 — per-expense chat (supersedes the friend-DM chat)
--
-- Chat is a private message thread PER EXPENSE (group or non-group), keyed by
-- `messages.expense_id`. A message in expense A is never visible from expense B —
-- isolation is structural (every read is `where expense_id = $1`) and enforced by RLS
-- (`can_chat_expense`). This replaces the earlier friend-to-friend `conversations`
-- model (see docs/update_chat_feature.md, which supersedes roadmap/phase-6-chat.md).
--
-- Who may read/post in expense E: the expense OWNER, plus every LINKED account of a
-- member who participates in E (a split row). This reuses the members.linked_user_id
-- rail (0014/0016) and the cross-user visibility from 0015. A name-only member with no
-- linked account cannot chat.
--
-- Apply by hand in the Supabase SQL editor (migrations are not auto-run). This file is
-- safe to run once: it first DROPS the superseded friend-DM objects, then creates the
-- per-expense schema.
-- ─────────────────────────────────────────────────────────────

-- ============================================================================
-- 0. Drop the superseded friend-DM chat objects (from the earlier 0017)
--
-- The earlier chat model created `conversations` + a conversation-keyed `messages`
-- table and the are_friends / get_or_create_conversation / send_message functions.
-- They are replaced wholesale here. Dropping `messages` also removes it from the
-- `supabase_realtime` publication. (No-ops if this is a fresh database.)
-- ============================================================================
drop function if exists public.send_message(uuid, text);
drop function if exists public.get_or_create_conversation(uuid);
drop table if exists public.messages cascade;
drop table if exists public.conversations cascade;
drop function if exists public.are_friends(uuid, uuid);

-- ============================================================================
-- 1. messages — one row per message, keyed by the expense it belongs to
-- ============================================================================
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  expense_id  uuid not null references public.expenses(id) on delete cascade,
  sender_id   uuid not null references public.profiles(id),
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index idx_messages_expense_created
  on public.messages (expense_id, created_at);

comment on table public.messages is
  'A text/emoji message in one expense''s isolated thread (keyed by expense_id). '
  'sender_id is an account (profiles.id) — only linked participants can post. '
  'Bodies are rendered as text, never HTML.';

-- ============================================================================
-- 2. can_chat_expense(expense) — the read/post gate
--
-- True when the caller owns the expense, or is the linked account of a member who
-- participates in it (has a split row). SECURITY DEFINER so it can read the expense
-- and its splits/members regardless of the caller's own RLS; it returns only a
-- boolean. Reused by both RLS policies and callable by the app to decide whether to
-- show the composer.
-- ============================================================================
create or replace function public.can_chat_expense(p_expense uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.expenses e
    where e.id = p_expense and e.owner_id = auth.uid()
  ) or exists (
    select 1
    from public.expenses e
    join public.expense_splits s on s.expense_id = e.id
    join public.members m        on m.id = s.member_id
    where e.id = p_expense and m.linked_user_id = auth.uid()
  );
$$;

comment on function public.can_chat_expense is
  'True when auth.uid() may read/post in an expense''s chat: the expense owner, or a '
  'linked account of a member participating (split) in it. Used by messages RLS.';

grant execute on function public.can_chat_expense(uuid) to authenticated;

-- ============================================================================
-- 3. RLS — read/post only for allowed accounts; you can only post as yourself
-- ============================================================================
alter table public.messages enable row level security;

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (public.can_chat_expense(expense_id));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.can_chat_expense(expense_id));

-- ============================================================================
-- 4. Realtime — stream message INSERTs to subscribed clients
--
-- `messages` must be in the `supabase_realtime` publication for postgres_changes
-- subscriptions (filtered `expense_id=eq.<id>`) to receive anything; RLS above still
-- governs which rows each subscriber gets. (Equivalent to the Database → Replication
-- toggle.)
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
