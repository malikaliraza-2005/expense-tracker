-- ─────────────────────────────────────────────────────────────
-- Migration 0022 — protect expense integrity when a member is deleted
--
-- The ledger's foreign keys to `members` are deliberately RESTRICT, so a person who
-- is part of financial history can't be deleted out from under it:
--
--     expenses.paid_by         -> members  ON DELETE RESTRICT
--     settlements.payer_id     -> members  ON DELETE RESTRICT
--     settlements.receiver_id  -> members  ON DELETE RESTRICT
--     expense_splits.member_id -> members  ON DELETE CASCADE   <-- the odd one out
--
-- `expense_splits.member_id` was left CASCADE (migration 0010). The result is an
-- asymmetry: deleting the PAYER of an expense is correctly blocked, but deleting a
-- PARTICIPANT silently deletes their split — leaving an expense whose splits no longer
-- sum to its amount, and therefore balances derived from it that are quietly wrong.
--
-- The deleteMember action already refuses to delete a member referenced by an expense
-- or settlement, so the app never hits this. This aligns the database with the rule the
-- app already enforces, so no other path (a script, a future code path, a manual fix)
-- can corrupt an expense either. Deleting the EXPENSE still cascades its splits — that
-- FK (expense_splits.expense_id) is untouched.
--
-- Group membership stays CASCADE on purpose: removing a person from a group carries no
-- financial history, so it should follow them out.
--
-- Safe to apply: nothing in the app deletes a referenced member (and there is no
-- account-deletion flow), so this constraint should never fire in normal use — it is a
-- backstop.
-- ─────────────────────────────────────────────────────────────

alter table public.expense_splits
  drop constraint if exists expense_splits_member_id_fkey;

alter table public.expense_splits
  add constraint expense_splits_member_id_fkey
  foreign key (member_id) references public.members (id) on delete restrict;

comment on constraint expense_splits_member_id_fkey on public.expense_splits is
  'RESTRICT (not CASCADE): a member in an expense''s split set cannot be deleted, or '
  'the expense''s shares would silently stop summing to its amount. Matches '
  'expenses.paid_by and settlements.payer_id/receiver_id.';
