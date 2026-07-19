-- ─────────────────────────────────────────────────────────────
-- Migration 0030 — authorize the live "typing…" indicator channels
--
-- Phase 2 of docs/direct_messages.md. Typing indicators for BOTH direct messages and
-- per-expense chat ride Realtime **Broadcast** (ephemeral — a keystroke never touches
-- the database). This migration is what makes those broadcast channels PRIVATE: it adds
-- Realtime Authorization policies so only a thread's / an expense's real participants
-- may send or receive its typing events.
--
-- WHY A SEPARATE PRIVATE CHANNEL (not the existing message channel):
--   Messages are delivered on `dm-thread:<id>` / `expense-chat:<id>` via
--   postgres_changes, whose delivery is already RLS-gated on the underlying table. Those
--   channels are left exactly as they are. Typing runs on its OWN channels
--   `dm-typing:<id>` / `expense-typing:<id>`, marked `{ private: true }` client-side.
--   Isolating typing means that if this authorization is ever misconfigured, only the
--   typing indicator degrades — message delivery is untouched.
--
-- HOW REALTIME AUTHORIZATION WORKS:
--   When a client subscribes to (or broadcasts on) a channel with `private: true`,
--   Realtime checks RLS on the `realtime.messages` table using the caller's JWT, with
--   `realtime.topic()` returning the channel's topic string. `realtime.messages` has RLS
--   enabled and NO policies by default, so every private channel is denied until a
--   policy opens it. These two policies open ONLY the two typing topic families, scoped
--   to participants — nothing else becomes reachable.
--
--   * receiving a broadcast  → checked as SELECT on realtime.messages
--   * sending a broadcast     → checked as INSERT on realtime.messages
--
-- The participation check reuses the EXISTING gates — `can_access_dm_thread` (0029) for
-- DMs, `can_chat_expense` (0017) for per-expense chat — so typing can never reach anyone
-- who couldn't already read the thread. It fails CLOSED: an unknown prefix or a
-- malformed id yields false, and a bad uuid cast is caught before it can raise.
--
-- Additive and idempotent; apply by hand in the Supabase SQL editor. Safe to apply
-- independently of 0029, but typing for DMs only does anything once 0029's tables exist.
-- ─────────────────────────────────────────────────────────────

-- ============================================================================
-- 1. can_receive_typing — is the caller a participant of the thread/expense a typing
--    topic names? The single predicate behind both policies below.
--
-- SECURITY DEFINER so the underlying gates (themselves DEFINER) resolve; STABLE; and it
-- validates the id shape itself so a hand-crafted topic like `dm-typing:not-a-uuid`
-- returns false instead of raising inside a policy. auth.uid() is available in the
-- Realtime authorization context (the check runs under the subscriber's JWT).
-- ============================================================================
create or replace function public.can_receive_typing(p_topic text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_id text;
begin
  if p_topic is null then
    return false;
  end if;

  if starts_with(p_topic, 'dm-typing:') then
    v_id := split_part(p_topic, ':', 2);
    if v_id !~ '^[0-9a-fA-F-]{36}$' then
      return false; -- not a uuid → fail closed, never raise
    end if;
    return public.can_access_dm_thread(v_id::uuid);

  elsif starts_with(p_topic, 'expense-typing:') then
    v_id := split_part(p_topic, ':', 2);
    if v_id !~ '^[0-9a-fA-F-]{36}$' then
      return false;
    end if;
    return public.can_chat_expense(v_id::uuid);
  end if;

  return false; -- any other topic is not a typing topic we authorize
end;
$$;

comment on function public.can_receive_typing is
  'True when the caller may take part in the typing channel `p_topic` names — reusing '
  'can_access_dm_thread (DMs, 0029) / can_chat_expense (per-expense, 0017). The predicate '
  'behind the realtime.messages typing policies (0030). Fails closed on any unknown '
  'prefix or malformed id.';

-- Callable in the authorization context. Belt-and-braces revoke from public/anon per
-- the 0028 rule (a fresh create grants EXECUTE to PUBLIC by default).
revoke all on function public.can_receive_typing(text) from public;
revoke all on function public.can_receive_typing(text) from anon;
grant execute on function public.can_receive_typing(text) to authenticated;

-- ============================================================================
-- 2. realtime.messages policies — open ONLY the typing broadcast topics to participants
--
-- realtime.messages already has RLS enabled (Supabase default). These are additive: they
-- grant nothing outside the two typing topic families, and postgres_changes on the
-- public message channels doesn't consult this table at all.
-- ============================================================================
drop policy if exists typing_broadcast_receive on realtime.messages;
create policy typing_broadcast_receive
  on realtime.messages for select to authenticated
  using (
    extension = 'broadcast'
    and public.can_receive_typing((select realtime.topic()))
  );

drop policy if exists typing_broadcast_send on realtime.messages;
create policy typing_broadcast_send
  on realtime.messages for insert to authenticated
  with check (
    extension = 'broadcast'
    and public.can_receive_typing((select realtime.topic()))
  );
