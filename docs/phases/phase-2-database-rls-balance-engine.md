# Phase 2 — Database, RLS & Balance Engine

> **Highest-risk, highest-value gate.** Prove the schema, access control, and split/balance math before any UI depends on them. Do not proceed until the math and RLS are verified.

## 1. Phase Overview

**Objective**
Establish the complete relational schema with correct RLS, and prove the split + balance logic in isolation.

**Scope**
All remaining tables, enums, indexes, and RLS policies; the plain-TypeScript `splits` and `balances` modules; seed data and verification.

**Expected outcome**
A trustworthy foundation: correct schema, enforced RLS, and a verified balance engine.

---

## 2. Features / Modules

**Included:** full schema (`friendships`, `groups`, `group_members`, `expenses`, `expense_splits`, `settlements`, `categories`), enums, RLS, split module, balance module.

**User flows:** none user-facing (a throwaway internal page may display computed balances against seed data for verification).

**Business rules**
- Money as integer cents; `sum(share_cents) == amount_cents` for every expense.
- Balances derived from `expense_splits` + `settlements`; never stored.
- Remainder distribution is deterministic and stable.

---

## 3. Backend Implementation Plan

**Backend tasks**
- Create all remaining tables per the ERD with FKs and indexes.
- Define enums `group_type`, `split_type`; seed `categories`.
- Write RLS policies for every table (membership-scoped).
- Implement `lib/splits.ts`: equal / exact / percentage → integer shares with remainder handling.
- Implement `lib/balances.ts`: net splits vs. payments vs. settlements → per-friend, per-group, overall.

**Database operations**
- Bulk schema creation; seed categories; RLS enable + policies.

**Server actions / API requirements**
- Typed read helpers in `lib/queries/*` that later actions/components consume. No user-facing endpoints yet.

**Security considerations**
- RLS enabled on **every** table; deny-by-default; membership predicates via `group_members`.
- Verify no table is left world-readable/writable.

---

## 4. Frontend Implementation Plan

**Pages / components:** none required. Optional internal `/dev/balances` page (removed later) to eyeball computed values.

**UI states:** n/a.

**User interactions:** n/a.

---

## 5. Database Changes

**Tables affected:** `friendships`, `groups`, `group_members`, `expenses`, `expense_splits`, `settlements`, `categories` (all created this phase).

**Schema changes**
- Enums `group_type`, `split_type`.
- Full column sets and FKs per [database-design.md](../database-design.md) §2.
- Constraints: unique friend pair, unique group membership, `expense_splits` cascade on expense delete.

**RLS policies**
- Per-table policies per [database-design.md](../database-design.md) §7.

**Indexes / triggers**
- Indexes on all FK columns + `expense_date` (see database-design §5).
- No new triggers required (balance logic stays in TypeScript).

---

## 6. Files / Modules Expected To Be Created

- SQL migration(s): tables, enums, indexes, RLS policies, category seed.
- `src/lib/splits.ts` — split math.
- `src/lib/balances.ts` — balance math.
- `src/lib/queries/*` — initial typed read helpers.
- `src/types/db.ts` — shared entity types.
- (Optional, temporary) `src/app/(app)/dev/balances/page.tsx` for verification.

---

## 7. Dependencies

**Previous phases:** Phase 1 (`profiles`, `auth.uid()`).
**Depends on:** the entity model in [database-design.md](../database-design.md).

---

## 8. Testing Checklist

**Functional (split module)**
- [ ] Equal split with indivisible totals distributes remainder so shares sum to total.
- [ ] Exact split rejects shares that don't sum to the total.
- [ ] Percentage split (summing to 100) yields cents that sum exactly to the total.

**Functional (balance module)**
- [ ] Balances net correctly after multiple expenses.
- [ ] A settlement reduces the correct balance by exactly its amount.
- [ ] Per-friend, per-group, and overall figures agree with hand-computed values.

**Security**
- [ ] Two-user RLS test: cross-user reads/writes blocked; in-group reads succeed.
- [ ] No table left open; deny-by-default confirmed.

**Edge cases**
- [ ] Odd-cent totals (e.g., 100 / 3).
- [ ] Single-participant expense.
- [ ] Fully settled → zero balance.

**Acceptance criteria**
- [ ] All three split types sum exactly to total; balances reconcile; RLS holds. **Gate: must pass before Phase 3.**

---

## 9. Demo Checklist

- [ ] Show seed data → computed balances match expected values (internal view or query output).
- [ ] Demonstrate a cross-user query returning nothing (RLS).
- [ ] Walk through the split module output for each split type.
