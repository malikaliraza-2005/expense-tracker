-- ─────────────────────────────────────────────────────────────
-- Migration 0009 — expense RPCs: avoid INSERT/UPDATE ... RETURNING
--
-- Root cause of "Create Expense → Something went wrong" (SQLSTATE 42501):
-- On this project, an `INSERT ... RETURNING` (or `UPDATE ... RETURNING`) whose
-- RLS WITH CHECK invokes a SECURITY DEFINER helper (expenses_insert_creator →
-- is_group_member, expense_splits_insert_owner → owns_expense) is rejected with
-- "new row violates row-level security policy", even though the SAME write
-- WITHOUT a RETURNING clause succeeds and the row is valid. This was proven
-- empirically: PostgREST `return=minimal` inserts (no RETURNING) succeed under a
-- real user JWT, while `return=representation` and the RPC's `RETURNING * INTO`
-- fail. The table policies, helper functions, grants, and FKs are all correct —
-- only the RETURNING form trips the check in the PostgREST/authenticator session.
--
-- Migrations 0005's functions used `INSERT ... RETURNING * INTO v_expense` and
-- `UPDATE ... RETURNING * INTO v_expense`. This migration rewrites both to run
-- the DML with NO returning clause, then read the row back with a plain SELECT.
-- Behaviour is otherwise identical: still SECURITY INVOKER (RLS applies),
-- created_by still forced to auth.uid(), splits still replaced wholesale, and
-- the "not editable by caller" guard preserved via the row-count check.
-- ─────────────────────────────────────────────────────────────

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
  v_id      uuid := gen_random_uuid();   -- pre-generate so we need no RETURNING
begin
  insert into public.expenses (
    id, group_id, title, description, amount_cents, currency,
    category_id, expense_date, paid_by, created_by, notes
  )
  values (
    v_id,
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
  );

  insert into public.expense_splits (expense_id, user_id, share_cents, split_type)
  select
    v_id,
    (elem ->> 'user_id')::uuid,
    (elem ->> 'share_cents')::int,
    p_split_type
  from jsonb_array_elements(p_splits) as elem;

  select * into v_expense from public.expenses where id = v_id;
  return v_expense;
end;
$$;

comment on function public.create_expense_with_splits is
  'Phase 4 — atomically insert an expense and its expense_splits. SECURITY INVOKER: RLS applies; created_by is forced to auth.uid(). Uses a pre-generated id + plain SELECT (no INSERT...RETURNING) to avoid the 42501 RETURNING/RLS interaction on this project.';

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
  where id = p_expense_id;   -- no RETURNING

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

  select * into v_expense from public.expenses where id = p_expense_id;
  return v_expense;
end;
$$;

comment on function public.update_expense_with_splits is
  'Phase 4 — atomically update an expense and replace its expense_splits. SECURITY INVOKER: RLS applies. Uses plain SELECT (no UPDATE...RETURNING) to avoid the 42501 RETURNING/RLS interaction; raises when the caller may not edit the expense (0 rows updated).';
