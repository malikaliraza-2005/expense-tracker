-- ─────────────────────────────────────────────────────────────
-- Migration 0025 — chat messages appear in the Activity feed
--
-- Sending a chat message currently fans out over realtime only: someone who isn't
-- looking at that expense never learns a message arrived. This adds a `chat_message`
-- activity so it shows up in their feed and deep-links to the thread.
--
-- Two things this has to get right:
--
--   1. The `type` CHECK is a HARD GATE. `logActivity` swallows errors by contract, so
--      a type missing from this list would be rejected by Postgres and the event would
--      vanish *silently*. A new activity kind is always a migration, never just a TS
--      union edit.
--
--   2. Noise. Chat is chatty: one row per message would bury expense and settlement
--      notifications under a single conversation. So a thread gets ONE entry per
--      reader, bumped to now on each new message while it's still unread — the feed
--      says "there are new messages here", not "here is every message".
--
-- Chat is per-EXPENSE (0017): `messages` has no group_id. The group is reached through
-- `expenses.group_id` and is denormalized onto the event as `context_label`, so the
-- line can read "… in “Trip to Naran”" — and is simply absent for a non-group expense.
--
-- Additive and idempotent; apply by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────

-- ============================================================================
-- 1. Allow the new type
-- ============================================================================
alter table public.activity_events drop constraint if exists activity_events_type_check;
alter table public.activity_events add constraint activity_events_type_check
  check (type in (
    'expense_created', 'expense_added_you', 'expense_updated', 'expense_deleted',
    'group_created', 'group_added_you', 'group_removed_you', 'group_left',
    'settlement_recorded', 'settlement_received',
    'friend_added', 'friend_removed',
    'balance_changed',
    'chat_message'));

-- ============================================================================
-- 2. log_chat_activity(expense) — one batched entry per reader, per thread
--
-- Resolves the readers itself (the expense owner + every linked participant, minus the
-- sender) rather than trusting the caller, and re-checks `can_chat_expense` so a
-- non-participant can't inject events into other people's feeds.
--
-- Batching: while an entry for this thread is still unread, a new message BUMPS it
-- (fresh timestamp + sender) instead of inserting another row. Once read, the next
-- message starts a new entry — so the feed resurfaces, but never floods.
--
-- SECURITY DEFINER: it writes to other users' feeds (owner-scoped RLS forbids that
-- directly) and reads splits/members the caller may not see. Returns rows touched.
-- ============================================================================
create or replace function public.log_chat_activity(p_expense_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_name      text;
  v_expense   public.expenses%rowtype;
  v_context   text;
  v_recipient uuid;
  v_count     int := 0;
begin
  if v_uid is null or p_expense_id is null then
    return 0;
  end if;
  -- Only someone who may chat here may generate its notifications.
  if not public.can_chat_expense(p_expense_id) then
    return 0;
  end if;

  select * into v_expense from public.expenses where id = p_expense_id;
  if not found then
    return 0;
  end if;

  select full_name into v_name from public.profiles where id = v_uid;
  if v_expense.group_id is not null then
    select name into v_context from public.groups where id = v_expense.group_id;
  end if;

  for v_recipient in
    select distinct acct
    from (
      -- the ledger owner
      select v_expense.owner_id as acct
      union
      -- every participant that is a real account
      select m.linked_user_id
      from public.expense_splits s
      join public.members m on m.id = s.member_id
      where s.expense_id = p_expense_id and m.linked_user_id is not null
    ) t
    where acct is not null and acct <> v_uid   -- never notify yourself
  loop
    update public.activity_events
      set created_at    = now(),
          actor_id      = v_uid,
          actor_name    = v_name,
          subject       = v_expense.title,
          context_label = v_context
      where owner_id   = v_recipient
        and type       = 'chat_message'
        and expense_id = p_expense_id
        and read_at is null;

    if not found then
      insert into public.activity_events (
        owner_id, type, actor_id, actor_name, subject,
        expense_id, group_id, context_label)
      values (
        v_recipient, 'chat_message', v_uid, v_name, v_expense.title,
        p_expense_id, v_expense.group_id, v_context);
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.log_chat_activity is
  'Notify an expense thread''s other participants of a new chat message: one entry per '
  'reader, bumped while unread rather than duplicated. Resolves recipients itself and '
  're-checks can_chat_expense. Never notifies the sender.';

grant execute on function public.log_chat_activity(uuid) to authenticated;
