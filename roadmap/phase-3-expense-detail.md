# Phase 3 — Expense Detail enhancements

**Goal:** Per-member ledger with owe/paid/remaining, per-member remove buttons,
in-place settle-up, and an "add to friends?" prompt when adding a member.

**Status:** Code complete — pending manual/E2E verification. Sequenced
**before/with Phase 2** so settlement recording is never absent after the People
page is removed. No new migration: member removal reuses the live
`update_expense_with_splits` RPC (0010).

---

## Context

`src/components/expenses/expense-detail.tsx` already renders per-member participant
rows (avatar, name, "You owe X" / "Owes you", equal share, share/settled label). This
phase deepens those rows into a full ledger, adds member removal, relocates the
settle-up UI here from the People page, and offers to promote an expense participant
to a friend.

Balances are derived on read in `src/lib/balances.ts` — reuse it, do not store
balances. Settlement writes already exist: `recordSettlement` / `deleteSettlement` in
`src/actions/settlements.ts`, surfaced today by
`src/components/members/settlement-controls.tsx` (`SettleUpDialog`,
`LedgerSettleUpDialog`, `DeleteSettlementButton`).

## Technical approach

1. **Per-member ledger rows.** Extend each participant row to show **paid**, **owed**,
   and **remaining** explicitly (derive from splits + settlements via
   `src/lib/balances.ts`; expose the numbers through the `ExpenseDetail` DTO in
   `src/lib/queries/expenses.ts` if not already present).
2. **Remove button (cross icon) per member.** Owner-only control that removes a member
   from the expense. Backend: prefer extending the `update_expense_with_splits` RPC
   (migration 0010) to accept the new member set; if that's awkward, add a targeted
   `removeExpenseMember` action in `src/actions/expenses.ts` that deletes that
   member's `expense_splits` row and recomputes equal shares. Guard: cannot remove the
   payer or the last remaining member.
3. **Relocate settle-up here.** Port `SettleUpDialog` / record-payment into the
   Expense Detail per-member rows and/or a per-expense "Settle up" action, calling the
   existing `recordSettlement` / `deleteSettlement`. This is the new home for the
   People-page settlement UI (Phase 2 dependency).
4. **"Add to friends?" prompt.** After a member is added to an expense via
   `PersonSearch` (`src/components/expenses/expense-form.tsx`, or from Expense Detail),
   prompt: *"Do you also want to add this member to your friends list?"* → on yes, call
   `inviteMemberByEmail` (if an email is known) or open the Phase 4 friend-add flow.
   Ties members → friends per the linked-member model.

## Files to change

- **Edit:** `src/components/expenses/expense-detail.tsx` (ledger rows + remove +
  settle-up), `src/components/expenses/expense-form.tsx` ("add to friends?" prompt),
  `src/actions/expenses.ts` (member removal / recompute),
  `src/actions/settlements.ts` (reuse; wire into detail),
  `src/lib/queries/expenses.ts` (expose paid/owed/remaining in `ExpenseDetail` DTO).
- **Reuse:** `src/lib/balances.ts`, `recordSettlement`/`deleteSettlement`,
  `SettleUpDialog` (lift out of `settlement-controls.tsx` before Phase 2 deletes it),
  `PersonSearch`, `inviteMemberByEmail`.

## Schema / migration

Usually none — `update_expense_with_splits` (0010) can re-write the split set. Only
if a dedicated remove is cleaner, add a small RPC (apply by hand):

```sql
-- optional; only if not folding removal into update_expense_with_splits
create or replace function remove_expense_member(p_expense uuid, p_member uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- owner check via RLS-equivalent guard on expenses.owner_id = auth.uid()
  -- reject if p_member is the payer or the only remaining split
  delete from expense_splits where expense_id = p_expense and member_id = p_member;
  -- recompute equal shares across remaining splits
end $$;
```

## Edge cases

- Removing the **payer** → blocked with a clear message.
- Removing down to **one** participant → blocked (nothing to split).
- Settling **more than owed** → clamp / validate in `recordSettlement`.
- Expense already **settled** then a member is removed → recompute + re-evaluate the
  settled flag.
- Equal-split **rounding** on recompute → keep parity with existing splits logic
  (`tests/unit/splits.test.ts`).
- Non-owner viewing a shared expense (0015) → read-only, no remove/settle controls.

## Testing

- **Unit (vitest):** extend `tests/unit/splits.test.ts` for member-removal recompute
  (rounding, remainder distribution) and `tests/unit/balances.test.ts` for
  paid/owed/remaining.
- **Manual:** add/remove members on an expense; record + delete a settlement from the
  detail; confirm balances update; confirm payer/last-member guards; confirm the
  "add to friends?" prompt appears and routes correctly.

## Done when

- [x] Each member row shows paid / owed / remaining.
- [x] Owner can remove a member (cross icon) with payer/last-member guards; shares
      recompute.
- [x] Settle-up + record/delete payment work from Expense Detail.
- [x] Adding a member prompts "add to friends?" and routes to the friend flow.
- [x] Unit tests cover removal recompute and the new balance fields; all green.

## Implementation notes

- **Ledger figures** derive from a pure `expenseMemberLedger()` in
  `src/lib/balances.ts` (paid = full total for the payer / 0 otherwise; owed =
  share; remaining = 0 when the expense's settled flag is set, else the payer is
  owed `amount − own share` and each other participant owes their share). Exposed
  on the `ExpenseParticipant` DTO and populated in `getExpense`.
- **Remove** is a targeted `removeExpenseMember` action that recomputes equal
  shares via a pure `recomputeEqualAfterRemoval()` (splits.ts) and re-writes the
  split set through the existing `update_expense_with_splits` RPC — **no new
  migration**, and every other field (including the settled flag) is preserved.
- **Settle-up** settles the owner's OVERALL balance with a person (group-scoped
  for a group expense), reusing `SettleUpDialog`. That control + delete-payment
  were **lifted out** of `components/members/settlement-controls.tsx` to
  `components/settlements/settlement-controls.tsx` ahead of Phase 2.
- **"Add to friends?"** lives in the expense form (`suppressInvitePrompt` on
  `PersonSearch` hands the prompt to the form), opening `InviteByEmailDialog` —
  the linked-member = friend rail. The dedicated Friends page is Phase 4.
