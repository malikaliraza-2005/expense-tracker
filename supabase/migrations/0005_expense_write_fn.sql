-- ─────────────────────────────────────────────────────────────
-- Migration 0005 — atomic expense + splits write functions
--
-- Phase 4 (Expenses & Splitting). The one justified SQL function in the MVP
-- (development-guidelines §9): writing an expense together with its
-- `expense_splits` rows in a SINGLE transaction so the core invariant — an
-- expense always has a matching, summing-to-total set of splits — can never be
-- broken by a partial write.
--
-- Both functions are SECURITY INVOKER (the default): they run as the calling
-- user, so the Phase 2 Row Level Security policies still apply to every
-- statement inside them (expenses_insert_creator, expense_splits_insert_owner,
-- expenses_update_creator, …). `created_by` is forced to auth.uid() here so the
-- caller can never spoof authorship.
--
-- The split MATH and all business-rule validation (sum = total, percentages =
-- 100, payer/participant membership) live in TypeScript — lib/splits.ts and the
-- expense Server Actions. These functions only persist the already-computed,
-- already-validated integer-cent shares atomically. See
-- docs/phases/phase-4-expenses-splitting.md §3 and api-design.md §4.5.
-- ─────────────────────────────────────────────────────────────

-- ============================================================================
-- create_expense_with_splits
--
-- Inserts one expense and its splits. `p_splits` is a JSON array of
--   [{ "user_id": "<uuid>", "share_cents": <int> }, …]
-- with `p_split_type` applied to every row. Returns the inserted expense.
-- ============================================================================
create or replace function public.create_expense_with_splits(
  p_group_id     uuid,
  p_title        text,
  p_description  text,
  p_amount_cents int,
  p_currency     text,
  p_category_id  int,
  p_expense_date date,
  p_paid_by      uuid,
  p_notes        text,
  p_split_type   public.split_type,
  p_splits       jsonb
)
returns public.expenses
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_expense public.expenses;
begin
  insert into public.expenses (
    group_id, title, description, amount_cents, currency,
    category_id, expense_date, paid_by, created_by, notes
  )
  values (
    p_group_id,
    p_title,
    nullif(p_description, ''),
    p_amount_cents,
    coalesce(nullif(p_currency, ''), 'USD'),
    p_category_id,
    coalesce(p_expense_date, current_date),
    p_paid_by,
    auth.uid(),          -- authorship is server-set, never client-supplied
    nullif(p_notes, '')
  )
  returning * into v_expense;

  insert into public.expense_splits (expense_id, user_id, share_cents, split_type)
  select
    v_expense.id,
    (elem ->> 'user_id')::uuid,
    (elem ->> 'share_cents')::int,
    p_split_type
  from jsonb_array_elements(p_splits) as elem;

  return v_expense;
end;
$$;

comment on function public.create_expense_with_splits is
  'Phase 4 — atomically insert an expense and its expense_splits. SECURITY INVOKER: RLS applies; created_by is forced to auth.uid(). Shares are pre-validated in the Server Action.';

-- ============================================================================
-- update_expense_with_splits
--
-- Updates an existing expense's editable fields and REPLACES all of its splits
-- (delete + re-insert) in one transaction. Raises if the expense is not
-- updatable by the caller (RLS filters it out → 0 rows), aborting the whole
-- transaction so no partial edit or orphaned splits can result.
-- ============================================================================
create or replace function public.update_expense_with_splits(
  p_expense_id   uuid,
  p_group_id     uuid,
  p_title        text,
  p_description  text,
  p_amount_cents int,
  p_currency     text,
  p_category_id  int,
  p_expense_date date,
  p_paid_by      uuid,
  p_notes        text,
  p_split_type   public.split_type,
  p_splits       jsonb
)
returns public.expenses
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_expense public.expenses;
begin
  update public.expenses
  set
    group_id     = p_group_id,
    title        = p_title,
    description  = nullif(p_description, ''),
    amount_cents = p_amount_cents,
    currency     = coalesce(nullif(p_currency, ''), 'USD'),
    category_id  = p_category_id,
    expense_date = coalesce(p_expense_date, current_date),
    paid_by      = p_paid_by,
    notes        = nullif(p_notes, '')
  where id = p_expense_id
  returning * into v_expense;

  if not found then
    raise exception 'Expense not found or not editable by the current user.';
  end if;

  -- Replace the split set wholesale — splits are recomputed on every edit.
  delete from public.expense_splits where expense_id = p_expense_id;

  insert into public.expense_splits (expense_id, user_id, share_cents, split_type)
  select
    p_expense_id,
    (elem ->> 'user_id')::uuid,
    (elem ->> 'share_cents')::int,
    p_split_type
  from jsonb_array_elements(p_splits) as elem;

  return v_expense;
end;
$$;

comment on function public.update_expense_with_splits is
  'Phase 4 — atomically update an expense and replace its expense_splits. SECURITY INVOKER: RLS applies. Raises (aborting the transaction) when the caller may not edit the expense.';
