# Phase 5 — Dashboard & Settlements

> **Completes the MVP.** After this phase, the app is a fully functional expense-sharing product.

## 1. Phase Overview

**Objective**
Give users the "home" overview and the ability to settle debts, closing the MVP loop.

**Scope**
Dashboard (total balance, you owe, you are owed, net, recent expenses, groups overview, quick actions); individual & group balance views; Settle Up.

**Expected outcome**
A complete home experience where every number reconciles with the ledger, and debts can be settled.

---

## 2. Features / Modules

**Included:** Dashboard, Individual Balances, Group Balances, Record Settlement, quick-add entry points.

**User flows**
- **Dashboard:** on login, see totals, recent expenses, and groups overview; use quick-add for expense/group.
- **View balances:** open a friend or group to see who-owes-whom.
- **Settle up:** choose payer/receiver, amount, optional note → record → balances update everywhere.

**Business rules**
- All figures derive from `expense_splits` + `settlements`; single currency.
- Payer ≠ receiver; settlement amount > 0.

---

## 3. Backend Implementation Plan

**Backend tasks**
- Dashboard aggregation via `lib/balances` (owe/owed/net) + recent activity reads.
- `recordSettlement`: write `settlements`; balances re-net on next read.

**Database operations**
- Insert `settlements`; aggregate reads over `expense_splits` + `settlements`.

**Server actions / API requirements**
- `recordSettlement`.
- Reads: `getDashboard`, `getGroupLedger`, `getFriendBalance`.

**Security considerations**
- RLS ensures settlements are visible only to participants/group members.
- Server validates payer/receiver relationship and amount.

---

## 4. Frontend Implementation Plan

**Pages / components**
- Dashboard page: summary cards (total, you owe, you are owed, net), recent expenses, groups overview, quick-add buttons.
- Balance views: per-friend and per-group ledgers.
- Settle Up dialog (payer/receiver/amount/note).

**UI states**
- Dashboard: loading skeletons, empty (no activity) state, populated.
- Settle Up: idle, submitting, validation error, success.

**User interactions**
- Quick-add expense/group; open ledgers; record a settlement.

---

## 5. Database Changes

**Tables affected:** `settlements` (created in Phase 2 — used here).

**Schema changes:** none new.

**RLS policies:** rely on Phase 2 policies; verify settlement visibility.

**Indexes / triggers:** none new.

---

## 6. Files / Modules Expected To Be Created

- `src/app/(app)/dashboard/page.tsx`.
- `src/lib/actions/settlements.ts`.
- `src/lib/queries/dashboard.ts` (+ ledger reads).
- Components: `SummaryCards`, `RecentExpenses`, `GroupsOverview`, `SettleUpDialog`, `BalanceLedger`.

---

## 7. Dependencies

**Previous phases:** Phase 4 (expenses feed all balances); Phases 2–3.
**Depends on:** `lib/balances`, expense/group/friend data.

---

## 8. Testing Checklist

**Functional**
- [ ] Dashboard figures (total, owe, owed, net) reconcile with the ledger.
- [ ] Recent expenses and groups overview render correct data.
- [ ] Settlement reduces the correct balance by exactly its amount and updates all affected views.

**Security**
- [ ] Settlements visible only to participants/group members.
- [ ] Server rejects self-settlement and non-positive amounts.

**Edge cases**
- [ ] Zero balance / fully settled group.
- [ ] Negative and positive net.
- [ ] Settlement larger than outstanding balance (decide behavior; verify).

**Acceptance criteria**
- [ ] Dashboard reconciles; settlements update balances correctly. **MVP complete.**

---

## 9. Demo Checklist

- [ ] Log in → dashboard shows correct totals and recent activity.
- [ ] Open a friend/group ledger → who-owes-whom is correct.
- [ ] Record a settlement → balances update across dashboard and ledgers.
- [ ] Use quick-add to create an expense/group from the dashboard.
