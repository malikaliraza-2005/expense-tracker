-- ─────────────────────────────────────────────────────────────
-- Migration 0031 — a shared expense shows the SAME status on both accounts
--
-- The bug this fixes (reproduced against the database, not theorised):
--   An expense's "Settled / partly / outstanding" state is DERIVED on read from the
--   payment ledger (expenseSettlements in src/lib/balances.ts), never stored. Both
--   accounts are meant to derive the SAME status from the SAME rows. But settlements
--   are only READ-visible to a participant when they are one of the two parties
--   (0021 `settlements_select_shared`). So when a THIRD party pays — or the owner
--   records a name-only member's payment — the participant cannot see that settlement
--   and under-counts what's been settled on a shared expense.
--
--   Live example (expense 534481a3 "Dinner", owner 29881b6a, participant 3dc91f4c):
--     owner sees      owed=8750 settled=8750 remaining=0    → "Settled"
--     participant sees owed=8750 settled=1250 remaining=7500 → "Outstanding"
--   Same expense, same splits — the participant just can't see 16 of the 22
--   settlements, so their derived status lags. RLS also scopes the realtime stream,
--   so their page never even gets a live event for those payments.
--
-- Why an RPC and not a wider RLS read policy:
--   Making the participant read those settlement ROWS would leak the owner's payment
--   history with OTHER people, and STILL wouldn't be exact (the oldest-first
--   allocation runs across a pair's whole debt history, including expenses the
--   participant can't see). Instead, this computes the status inside a SECURITY
--   DEFINER boundary over the owner's COMPLETE ledger and returns only the AGGREGATE
--   numbers — the same figures the owner derives — leaking no rows. Same pattern as
--   settle_member / unsettle_member (0021/0026): a definer RPC that re-checks
--   authorization itself.
--
-- The maths is a faithful, set-based port of `expenseSettlements` (see the parity
-- test tests/unit/expense-status-allocation.test.ts, which pins the JS engine and
-- this same two-pass allocation to identical output):
--   • Per (debtor D, creditor P) pair, sort that pair's debts oldest-first.
--   • Pass 1: each GROUP-tagged settlement pool fills only its own group's debts,
--     oldest-first (a group-earmarked payment).
--   • Pass 2: the GLOBAL (untagged) pool then fills whatever remains, any scope,
--     oldest-first (the Activity/Friends "settle up", which pays the overall balance).
--   • A debt's settled amount is a running-sum clamp: min(remaining_pool, its share).
--
-- §2 adds a small realtime nudge so the fix is LIVE, not just correct-on-reload: a
-- settlement a participant can't see still touches the shared expenses it affects, so
-- their app (subscribed to `expenses`, which they CAN see) refreshes and re-derives.
--
-- Additive and idempotent; apply by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────

-- ============================================================================
-- 1. expense_settlement_status — aggregate settlement standing for expenses the
--    caller can see, computed from the OWNER's complete ledger (definer).
--
-- Returns one row per requested expense the caller may see (others are silently
-- dropped, exactly like a denied RLS read). `settled_by_member` maps each debtor's
-- member id to how much of THEIR share is settled — what the detail view needs for
-- per-participant "remaining", and the only per-member figure exposed.
-- ============================================================================
create or replace function public.expense_settlement_status(p_expense_ids uuid[])
returns table (
  expense_id        uuid,
  owed_cents        integer,
  settled_cents     integer,
  remaining_cents   integer,
  fully_settled     boolean,
  settled_by_member jsonb
)
language sql
security definer
stable
set search_path = public
as $$
  with
  -- Only expenses the caller may see. Definer bypasses RLS, so gate explicitly —
  -- this is the authorization boundary that keeps the aggregate from leaking.
  requested as (
    select e.id, e.owner_id, e.paid_by
    from public.expenses e
    where e.id = any(p_expense_ids)
      and public.can_see_expense(e.id)
  ),
  -- The (creditor = payer, debtor = participant) pairs the requested expenses touch.
  pairs as (
    select distinct r.owner_id, r.paid_by as creditor, s.member_id as debtor
    from requested r
    join public.expense_splits s
      on s.expense_id = r.id and s.member_id <> r.paid_by
  ),
  -- Each pair's WHOLE debt history in the owner's ledger (not just the requested
  -- expense) — settlements allocate oldest-first across all of it, so the requested
  -- expense's settled amount depends on the pair's older debts too.
  debts as (
    select
      p.owner_id, p.creditor, p.debtor,
      e2.id                           as expense_id,
      es.share_cents                  as amount,
      coalesce(e2.group_id::text, '') as scope,
      e2.expense_date, e2.created_at, e2.id::text as eid_text
    from pairs p
    join public.expenses e2
      on e2.owner_id = p.owner_id and e2.paid_by = p.creditor
    join public.expense_splits es
      on es.expense_id = e2.id and es.member_id = p.debtor
  ),
  -- Payment pools per (debtor -> creditor, scope). A settlement pays debtor->creditor;
  -- its group tag ('' = untagged/global) decides which debts it may clear.
  pool as (
    select
      st.owner_id, st.payer_id as debtor, st.receiver_id as creditor,
      coalesce(st.group_id::text, '') as scope,
      sum(st.amount_cents)::bigint as amt
    from public.settlements st
    join pairs p
      on p.owner_id = st.owner_id
     and p.debtor   = st.payer_id
     and p.creditor = st.receiver_id
    group by st.owner_id, st.payer_id, st.receiver_id, coalesce(st.group_id::text, '')
  ),
  -- Pass 1 — group-tagged pools fill only their own scope's debts, oldest-first.
  -- cum_before_scope = sum of earlier same-scope debts, so the clamp below is the
  -- greedy oldest-first fill: applied = min(pool - cum_before, this share).
  ordered as (
    select d.*,
      coalesce(sum(d.amount) over (
        partition by d.owner_id, d.creditor, d.debtor, d.scope
        order by d.expense_date nulls first, d.created_at nulls first, d.eid_text
        rows between unbounded preceding and 1 preceding
      ), 0) as cum_before_scope
    from debts d
  ),
  grp as (
    select o.*,
      case when o.scope = '' then 0
        else greatest(0, least(
          o.amount,
          coalesce((select amt from pool pl
            where pl.owner_id = o.owner_id and pl.debtor = o.debtor
              and pl.creditor = o.creditor and pl.scope = o.scope), 0)
          - o.cum_before_scope))
      end as applied_group
    from ordered o
  ),
  -- Pass 2 — the global (untagged) pool fills whatever remains, any scope,
  -- oldest-first across the pair's debts. Fills residuals (share − applied_group).
  resid as (
    select g.*, (g.amount - g.applied_group) as residual from grp g
  ),
  global_ordered as (
    select r.*,
      coalesce(sum(r.residual) over (
        partition by r.owner_id, r.creditor, r.debtor
        order by r.expense_date nulls first, r.created_at nulls first, r.eid_text
        rows between unbounded preceding and 1 preceding
      ), 0) as resid_cum_before
    from resid r
  ),
  applied as (
    select go.*,
      go.applied_group + greatest(0, least(
        go.residual,
        coalesce((select amt from pool pl
          where pl.owner_id = go.owner_id and pl.debtor = go.debtor
            and pl.creditor = go.creditor and pl.scope = ''), 0)
        - go.resid_cum_before)) as applied_total
    from global_ordered go
  )
  -- Aggregate back to ONLY the requested (visible) expenses. Non-payer shares =
  -- owed; allocated payments = settled; the rest is outstanding.
  select
    r.id as expense_id,
    coalesce(sum(a.amount), 0)::integer as owed_cents,
    coalesce(sum(a.applied_total), 0)::integer as settled_cents,
    greatest(0, coalesce(sum(a.amount), 0) - coalesce(sum(a.applied_total), 0))::integer
      as remaining_cents,
    (coalesce(sum(a.amount), 0) > 0
      and coalesce(sum(a.amount), 0) - coalesce(sum(a.applied_total), 0) <= 0) as fully_settled,
    coalesce(
      jsonb_object_agg(a.debtor::text, a.applied_total)
        filter (where a.applied_total > 0),
      '{}'::jsonb
    ) as settled_by_member
  from requested r
  left join applied a on a.expense_id = r.id
  group by r.id;
$$;

comment on function public.expense_settlement_status is
  'Aggregate settlement standing (owed/settled/remaining/fully_settled + per-member '
  'settled map) for each visible expense in p_expense_ids, computed from the OWNER''s '
  'complete ledger. Lets a shared participant derive the SAME status the owner sees '
  'without exposing individual settlement rows. Faithful port of expenseSettlements '
  '(src/lib/balances.ts). SECURITY DEFINER; gated by can_see_expense. See migration 0031.';

grant execute on function public.expense_settlement_status(uuid[]) to authenticated;

-- ============================================================================
-- 2. Realtime nudge — a settlement touches the shared expenses it affects
--
-- A participant cannot SELECT a settlement they aren't party to, and RLS also scopes
-- the realtime stream — so a third party's payment changes a shared expense's status
-- for them with no live signal. They CAN see the expense, though. This trigger gives
-- each affected expense a no-op touch on any settlement insert/delete, emitting a
-- `postgres_changes` event on `expenses` that every co-participant receives, so their
-- RealtimeSync refreshes and re-derives the status via §1. Correct-on-reload becomes
-- correct-live.
--
-- SECURITY DEFINER so it runs with full rights whether the settlement was written by
-- the owner (authenticated insert) or by the other party via settle_member (definer):
-- either way it may touch the owning ledger's expenses. Touches only amount_cents to
-- its own value — a pure no-op that changes nothing but the row's WAL version, and is
-- NOT one of the columns the 0027 ledger-guard trigger watches (owner_id/group_id/
-- paid_by), so that guard never fires.
-- ============================================================================
create or replace function public.settlements_touch_expenses()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := coalesce(new.owner_id, old.owner_id);
  v_a     uuid := coalesce(new.payer_id, old.payer_id);
  v_b     uuid := coalesce(new.receiver_id, old.receiver_id);
begin
  update public.expenses e
  set amount_cents = e.amount_cents  -- no-op touch: bumps the row so realtime fires
  where e.owner_id = v_owner
    and (
      (e.paid_by = v_a and exists (
        select 1 from public.expense_splits s
        where s.expense_id = e.id and s.member_id = v_b))
      or (e.paid_by = v_b and exists (
        select 1 from public.expense_splits s
        where s.expense_id = e.id and s.member_id = v_a))
    );
  return null; -- AFTER trigger; return value ignored
end;
$$;

drop trigger if exists settlements_touch_expenses on public.settlements;
create trigger settlements_touch_expenses
  after insert or delete on public.settlements
  for each row execute function public.settlements_touch_expenses();

comment on function public.settlements_touch_expenses is
  'Touches the shared expenses a settlement affects (both directions of the pair) so '
  'co-participants who cannot see the settlement still get a realtime `expenses` event '
  'and re-derive the expense status. SECURITY DEFINER. See migration 0031 §2.';
