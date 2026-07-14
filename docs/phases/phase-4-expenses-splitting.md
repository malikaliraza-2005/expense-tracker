# Phase 4 — Expenses & Splitting

> **Core UX phase.** The heart of the product. Completes core functionality when done.

## 1. Phase Overview

**Objective**
Deliver the full expense lifecycle with correct splitting, wired into the balance engine.

**Scope**
Add / edit / delete / view expenses; category; payer selection; equal / exact / percentage splits; expense list (with sorting; advanced filters are Phase-6-optional).

**Expected outcome**
Expenses can be added, split three ways, edited, and deleted, with balances always reconciling.

---

## 2. Features / Modules

**Included:** Add Expense, Edit Expense, Delete Expense, View Details, Categories, Payer Selection, Equal/Exact/Percentage Split, Expense History (list + sort).

**User flows**
- **Add expense:** choose group (or personal) → title, amount, category, date, payer → pick split type → configure shares (live-validated) → save → balances update.
- **Edit expense:** change fields/split → splits recompute → balances re-net.
- **Delete expense:** removes expense + splits → balances reverse.
- **View details:** see the expense with each participant's share.

**Business rules**
- Amount > 0; splits must sum to the total (exact) / percentages to 100.
- Expense + splits written atomically.
- Payer can be the user, a friend, or any group member.

---

## 3. Backend Implementation Plan

**Backend tasks**
- `createExpense`: validate → `lib/splits` → write expense + `expense_splits` atomically.
- `updateExpense`: recompute splits; `deleteExpense`: cascade splits.
- `listExpenses(filter)` read helper (sort by date; filters wired for Phase 6).

**Database operations**
- Insert expense + multiple `expense_splits` in one transaction.
- Update/delete cascades to splits.

**Server actions / API requirements**
- `createExpense`, `updateExpense`, `deleteExpense`.
- Reads: `getExpense`, `listExpenses`.
- The one justified SQL function: an atomic wrapper for expense + splits (integrity), if not done via a single transactional call.

**Security considerations**
- RLS ensures only group members/participants can create/edit/delete.
- Server re-validates split sums and payer membership.
- Atomicity prevents orphan expenses or mismatched splits.

---

## 4. Frontend Implementation Plan

**Pages / components**
- Expense form (add/edit) with split-type selector and **live validation** (exact sums to total; percentages sum to 100; equal preview).
- Expense detail view.
- Expense list with sort (newest/oldest); filter controls scaffolded (active in Phase 6).

**UI states**
- Form: idle, validating, invalid-split error, submitting, success.
- List: empty, loading, populated.

**User interactions**
- Configure splits per type; select payer/category/date; edit/delete; open details.

---

## 5. Database Changes

**Tables affected:** `expenses`, `expense_splits` (created in Phase 2 — used here).

**Schema changes:** none new (optionally add the atomic expense+splits SQL function).

**RLS policies:** rely on Phase 2 policies; verify write paths for members/participants.

**Indexes / triggers:** none new (indexes from Phase 2 cover query paths).

---

## 6. Files / Modules Expected To Be Created

- `src/app/(app)/expenses/` (list, `[expenseId]` detail) and/or expense entry within group pages.
- `src/lib/actions/expenses.ts`.
- `src/lib/queries/expenses.ts`.
- Components: `ExpenseForm`, `SplitEditor` (equal/exact/percentage), `ExpenseList`, `ExpenseDetail`, `PayerSelect`, `CategorySelect`.
- (Optional) SQL function for atomic expense+splits write.

---

## 7. Dependencies

**Previous phases:** Phase 2 (splits/balances, schema, RLS) and Phase 3 (groups/friends to split against).
**Depends on:** `lib/splits`, `lib/balances`, group/friend data.

---

## 8. Testing Checklist

**Functional**
- [ ] Equal split creates correct `expense_splits`; balances update.
- [ ] Exact split saves only when shares sum to total.
- [ ] Percentage split saves only when percentages sum to 100 and cents reconcile.
- [ ] Edit recomputes splits and re-nets balances.
- [ ] Delete reverses balances.

**Security**
- [ ] Non-member cannot create/edit/delete an expense in a group they're not in.
- [ ] Server rejects tampered split payloads.

**Edge cases**
- [ ] Odd-cent totals split evenly (remainder handled).
- [ ] Single-participant expense.
- [ ] Payer is a non-user group member.
- [ ] Failed split write leaves no orphan expense (atomicity).

**Acceptance criteria**
- [ ] Full expense lifecycle works; all three split types correct; balances always reconcile. **Completes core functionality.**

---

## 9. Demo Checklist

- [ ] Add an expense with an equal split → shares and balances correct.
- [ ] Add an exact-split and a percentage-split expense → validation and results correct.
- [ ] Edit an expense → balances update.
- [ ] Delete an expense → balances revert.
- [ ] Open expense details → per-person shares shown.
