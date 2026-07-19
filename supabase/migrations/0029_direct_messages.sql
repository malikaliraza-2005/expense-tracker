-- ─────────────────────────────────────────────────────────────
-- Migration 0029 — direct messages (one-to-one DMs between connected accounts)
--
-- Phase 1 of docs/direct_messages.md. Per-expense chat (0017) is unchanged and stays
-- exactly as it is: this is a SECOND, separate chat surface keyed by a pair of
-- ACCOUNTS rather than by an expense. The two share no rows.
--
-- Note for anyone reading the history: an early build (pre-0017) had a friend-DM
-- `conversations` model, and 0017 dropped it in favour of per-expense threads. This is
-- not that model resurrected — it is a deliberate, separately-scoped feature added
-- alongside per-expense chat. The tables are named `dm_*` precisely so nothing here is
-- confused with the objects 0017 dropped.
--
-- THE THREE RULES THIS MIGRATION ENFORCES (all in the database, not the app — a Server
-- Action is not a trust boundary; PostgREST exposes these tables to any user's JWT):
--
--   1. ONE thread per pair, forever. Not "the app looks first and inserts if missing" —
--      that races and yields duplicate parallel conversations. Instead the pair is
--      STORED CANONICALLY (`user_a < user_b`, enforced by a check) with a UNIQUE
--      constraint on (user_a, user_b). Two rows for one pair is then unrepresentable,
--      whatever order the arguments arrive in and however many callers race.
--   2. You may only open a DM with an account you are CONNECTED to — a `members` row
--      links you either direction (the same test `log_activity` uses). This is what
--      stops DMs being an unsolicited-message channel to any uuid an attacker learns
--      (0015/0023 hand out plenty of member/participant uuids legitimately).
--   3. Only the two participants may read or post in a thread.
--
-- 0028's lessons are applied throughout:
--   * `get_or_create_dm_thread` re-derives the caller from auth.uid() and NEVER trusts
--     an argument for identity — its only argument is the OTHER party, which it then
--     authorises rather than believes.
--   * Every function below is REVOKED FROM public/anon. A fresh `create function`
--     grants EXECUTE to PUBLIC by default and `anon` ∈ PUBLIC, so `grant ... to
--     authenticated` alone would add nothing and restrict nothing.
--
-- 0009's lesson is applied too: no `INSERT ... RETURNING` anywhere in the RPC. On this
-- project that form trips 42501 even inside a SECURITY DEFINER function; insert, then
-- read the row back with a plain SELECT.
--
-- Additive and idempotent; apply by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────

-- ============================================================================
-- 1. Tables
-- ============================================================================

-- One row per PAIR of accounts. `user_a < user_b` is not cosmetic: it is what makes
-- "one conversation per pair" a structural guarantee rather than an app convention.
-- Without the ordering check, (A,B) and (B,A) would be two distinct rows that the
-- unique constraint could never catch, and each user would end up talking into their
-- own private copy of the thread.
create table if not exists public.dm_threads (
  id         uuid        primary key default gen_random_uuid(),
  user_a     uuid        not null references public.profiles (id) on delete cascade,
  user_b     uuid        not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint dm_threads_ordered_pair check (user_a < user_b),
  constraint dm_threads_unique_pair  unique (user_a, user_b)
);

comment on table public.dm_threads is
  'A one-to-one conversation between two accounts. The pair is stored canonically '
  '(user_a < user_b) with a unique constraint, so a duplicate/parallel thread for the '
  'same pair is unrepresentable. Rows are created only by get_or_create_dm_thread.';

-- The unique constraint already indexes (user_a, user_b) — that covers lookups by
-- user_a and by the pair, but not a scan by user_b alone.
create index if not exists idx_dm_threads_user_b on public.dm_threads (user_b);

create table if not exists public.dm_messages (
  id         uuid        primary key default gen_random_uuid(),
  thread_id  uuid        not null references public.dm_threads (id) on delete cascade,
  sender_id  uuid        not null references public.profiles (id),
  body       text        not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

comment on table public.dm_messages is
  'One message in a DM thread. Mirrors public.messages (per-expense chat): body is '
  'plain text 1-2000 chars (emoji are Unicode), sender is an ACCOUNT, and there is no '
  'update/delete policy — messages are immutable once sent.';

-- Matches idx_messages_expense_created: every read is "this thread, oldest first".
create index if not exists idx_dm_messages_thread_created
  on public.dm_messages (thread_id, created_at);

-- Per-user read watermark. Deliberately a separate table rather than two columns on
-- dm_threads: a `last_read_a`/`last_read_b` pair would force every reader to know
-- which side of the pair they are before writing, and the RLS check would have to
-- branch on it. One row per (thread, user) keeps the policy a flat `user_id =
-- auth.uid()`, which is far harder to get wrong.
create table if not exists public.dm_reads (
  thread_id    uuid        not null references public.dm_threads (id) on delete cascade,
  user_id      uuid        not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

comment on table public.dm_reads is
  'How far one account has read in one DM thread. Unread = messages from the OTHER '
  'party newer than last_read_at. Absent row = nothing read yet.';

-- ============================================================================
-- 2. Authorization helpers (SECURITY DEFINER — they must see rows the caller cannot)
-- ============================================================================

-- Are I and p_other connected? Single-argument on purpose: the caller is re-derived
-- from auth.uid() and can never be spoofed by an argument (0028's rule). A two-argument
-- are_connected(a, b) would be an oracle letting anyone probe the social graph of
-- strangers; this one can only ever answer about the caller.
--
-- SECURITY DEFINER because the connection may live in the OTHER user's roster — a
-- `members` row owned by them and linked to me, which my own RLS correctly hides.
-- Checking only my side would make the answer depend on who invited whom.
create or replace function public.is_connected_to(p_other uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    auth.uid() is not null
    and p_other is not null
    and p_other <> auth.uid()
    and exists (
      select 1
      from public.members m
      where (m.owner_id = auth.uid() and m.linked_user_id = p_other)
         or (m.owner_id = p_other    and m.linked_user_id = auth.uid())
    );
$$;

comment on function public.is_connected_to is
  'True when the CALLER and p_other are linked by a members row either direction — the '
  'same "connected account" test log_activity uses. Single-argument by design: the '
  'caller comes from auth.uid(), never from an argument, so this cannot be used to '
  'probe whether two strangers know each other. See migration 0029.';

revoke all on function public.is_connected_to(uuid) from public;
revoke all on function public.is_connected_to(uuid) from anon;
grant execute on function public.is_connected_to(uuid) to authenticated;

-- Am I one of the two participants of this thread? The gate behind every dm_messages
-- and dm_reads policy.
--
-- SECURITY DEFINER + a helper (rather than an inline subquery on dm_threads in each
-- policy) for the reason 0010/0023 spell out: policies that read each other's tables
-- are how RLS recursion starts. Resolving the check inside a definer helper means
-- dm_messages' policy never re-enters dm_threads' policy. It fails closed — an unknown
-- thread id yields false.
create or replace function public.can_access_dm_thread(p_thread uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.dm_threads t
    where t.id = p_thread
      and auth.uid() is not null
      and (t.user_a = auth.uid() or t.user_b = auth.uid())
  );
$$;

comment on function public.can_access_dm_thread is
  'True when the caller is one of the two accounts on this DM thread. The gate for '
  'reading and posting. Membership of the thread — NOT current connection status — is '
  'what grants access, so a conversation stays readable if the two later unlink.';

revoke all on function public.can_access_dm_thread(uuid) from public;
revoke all on function public.can_access_dm_thread(uuid) from anon;
grant execute on function public.can_access_dm_thread(uuid) to authenticated;

-- ============================================================================
-- 3. RLS
-- ============================================================================

alter table public.dm_threads  enable row level security;
alter table public.dm_messages enable row level security;
alter table public.dm_reads    enable row level security;

-- Threads: readable by their two participants. There is deliberately NO insert/update/
-- delete policy — get_or_create_dm_thread (SECURITY DEFINER) is the only write path,
-- exactly as log_activity is the only write path for activity_events (0018). A client
-- INSERT is therefore rejected outright, so nobody can hand-craft a thread that names
-- an account they are not connected to and bypass rule 2.
drop policy if exists dm_threads_select on public.dm_threads;
create policy dm_threads_select
  on public.dm_threads for select to authenticated
  using (user_a = auth.uid() or user_b = auth.uid());

-- Messages: read and post only within a thread you are on, and you may only ever send
-- AS yourself (sender_id is pinned to auth.uid(), like messages_insert in 0017).
-- No update/delete policy: sent is sent.
drop policy if exists dm_messages_select on public.dm_messages;
create policy dm_messages_select
  on public.dm_messages for select to authenticated
  using (public.can_access_dm_thread(thread_id));

drop policy if exists dm_messages_insert on public.dm_messages;
create policy dm_messages_insert
  on public.dm_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.can_access_dm_thread(thread_id)
  );

-- Reads: your own watermark, on a thread you're on. Both halves matter — `user_id =
-- auth.uid()` alone would let you write a watermark row against a stranger's thread.
drop policy if exists dm_reads_select on public.dm_reads;
create policy dm_reads_select
  on public.dm_reads for select to authenticated
  using (user_id = auth.uid());

drop policy if exists dm_reads_upsert on public.dm_reads;
create policy dm_reads_upsert
  on public.dm_reads for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_dm_thread(thread_id));

drop policy if exists dm_reads_update on public.dm_reads;
create policy dm_reads_update
  on public.dm_reads for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.can_access_dm_thread(thread_id));

-- ============================================================================
-- 4. get_or_create_dm_thread — the only way a thread comes into existence
--
-- Idempotent and race-safe: concurrent first-messages from both sides converge on ONE
-- row. The unique constraint is the referee; `on conflict do nothing` + re-select is
-- how we defer to it instead of fighting it (the ensure_self_member pattern from 0019).
--
-- Returns null — rather than raising — when the pair isn't connected, so the caller
-- learns nothing about whether p_other is even a real account. Same discipline as
-- accept_invite's `return null` in 0028.
-- ============================================================================
create or replace function public.get_or_create_dm_thread(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_a   uuid;
  v_b   uuid;
  v_id  uuid;
begin
  if v_uid is null then
    return null; -- must be signed in
  end if;

  -- No self-DMs, and no DM to an account you have no connection with. is_connected_to
  -- re-derives the caller itself, so this cannot be spoofed by the argument.
  if p_other is null or p_other = v_uid then
    return null;
  end if;
  if not public.is_connected_to(p_other) then
    return null;
  end if;

  -- Canonical ordering: whoever calls, the same pair maps to the same row.
  v_a := least(v_uid, p_other);
  v_b := greatest(v_uid, p_other);

  select id into v_id
    from public.dm_threads
    where user_a = v_a and user_b = v_b;
  if v_id is not null then
    return v_id;
  end if;

  -- Deliberately no RETURNING (0009: INSERT ... RETURNING trips 42501 on this project).
  -- `do nothing` swallows the loser of a race; the SELECT below then finds the winner's
  -- row, so both callers get the same thread id.
  insert into public.dm_threads (user_a, user_b)
    values (v_a, v_b)
    on conflict (user_a, user_b) do nothing;

  select id into v_id
    from public.dm_threads
    where user_a = v_a and user_b = v_b;

  return v_id;
end;
$$;

comment on function public.get_or_create_dm_thread is
  'The id of the caller''s DM thread with p_other, creating it on first use. Null if '
  'not signed in, if p_other is the caller, or if the two are not connected — the '
  'check that keeps DMs from being an unsolicited-message channel. Race-safe and '
  'idempotent: the unique pair constraint guarantees one shared thread. See 0029.';

revoke all on function public.get_or_create_dm_thread(uuid) from public;
revoke all on function public.get_or_create_dm_thread(uuid) from anon;
grant execute on function public.get_or_create_dm_thread(uuid) to authenticated;

-- ============================================================================
-- 5. list_dm_threads — the conversation list in one round-trip
--
-- SECURITY INVOKER (the default) on purpose, unlike the helpers above: this reads only
-- rows the caller is already entitled to, so RLS should — and does — do the scoping.
-- Least privilege; no bypass to get wrong. The explicit auth.uid() predicate is belt
-- and braces on top of dm_threads_select.
--
-- Exists as a function purely to avoid an N+1 from the client (last message + unread
-- count per thread). It carries NO authorization logic of its own.
--
-- Names are NOT resolved here: profiles are self-only readable (0010 dropped
-- profiles_select_shared, and 0015 confirms that as deliberate), so a display name can
-- only come from the CALLER's own members roster. The query layer maps
-- linked_user_id → members.name, exactly as queries/chat.ts does for expense chat.
-- ============================================================================
create or replace function public.list_dm_threads()
returns table (
  thread_id      uuid,
  other_user_id  uuid,
  last_body      text,
  last_at        timestamptz,
  last_sender_id uuid,
  unread_count   integer
)
language sql
stable
set search_path = public
as $$
  select
    t.id,
    case when t.user_a = auth.uid() then t.user_b else t.user_a end,
    lm.body,
    lm.created_at,
    lm.sender_id,
    (
      select count(*)
      from public.dm_messages m
      where m.thread_id = t.id
        and m.sender_id <> auth.uid()
        and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
    )::int
  from public.dm_threads t
  left join public.dm_reads r
    on r.thread_id = t.id and r.user_id = auth.uid()
  left join lateral (
    select m.body, m.created_at, m.sender_id
    from public.dm_messages m
    where m.thread_id = t.id
    order by m.created_at desc, m.id desc
    limit 1
  ) lm on true
  where auth.uid() is not null
    and (t.user_a = auth.uid() or t.user_b = auth.uid())
  -- An empty thread (opened, never written to) sorts by when it was created.
  order by coalesce(lm.created_at, t.created_at) desc;
$$;

comment on function public.list_dm_threads is
  'The caller''s DM threads, newest-activity first, each with its last message and '
  'unread count. SECURITY INVOKER — RLS scopes it; this is a convenience read, not an '
  'authorization boundary. Display names are resolved by the caller from their own '
  'members roster (profiles are not readable across accounts).';

revoke all on function public.list_dm_threads() from public;
revoke all on function public.list_dm_threads() from anon;
grant execute on function public.list_dm_threads() to authenticated;

-- ============================================================================
-- 6. Realtime
--
-- dm_messages: the INSERT is what fans a message out to both clients (the same
-- mechanism per-expense chat uses). dm_threads: so a brand-new conversation appears in
-- the recipient's list without a reload.
--
-- Realtime applies RLS per subscriber, so these publications expose nothing that a
-- plain SELECT wouldn't. Note dm_messages is deliberately NOT added to RealtimeSync's
-- app-wide table list — a full router.refresh() on every keystroke-sized message would
-- be wasteful; the thread component subscribes to its own thread directly, exactly as
-- `messages` does.
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dm_messages'
  ) then
    alter publication supabase_realtime add table public.dm_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dm_threads'
  ) then
    alter publication supabase_realtime add table public.dm_threads;
  end if;
end
$$;
