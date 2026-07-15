-- ─────────────────────────────────────────────────────────────
-- Migration 0011 — per-expense "settled" flag (manual)
--
-- The owner can mark an individual expense as settled once everyone has squared
-- up for it. This is a lightweight, manual marker (not derived from the balance
-- ledger): a nullable timestamp that is NULL while outstanding and set to the
-- moment it was settled. The dashboard surfaces only outstanding expenses, and
-- the expenses list groups outstanding vs settled.
--
-- Authorization is unchanged: RLS already restricts every `expenses` row to its
-- owner (owner_id = auth.uid()), so the plain UPDATE the app issues is safe.
-- ─────────────────────────────────────────────────────────────

alter table public.expenses
  add column if not exists settled_at timestamptz;

comment on column public.expenses.settled_at is
  'When the owner marked this expense settled; NULL means still outstanding.';

-- Partial index to make the common "outstanding only" reads cheap.
create index if not exists idx_expenses_outstanding
  on public.expenses (owner_id, expense_date desc)
  where settled_at is null;
