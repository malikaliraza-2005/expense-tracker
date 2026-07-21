# Activity Page — Notifications & Per-Expense Settlement

> **Companion doc:** [update_chat_feature.md](update_chat_feature.md). The two share
> one data contract — see the **Shared Contracts** and **Sync Audit** sections at the
> end; they must be read together.
>
> **Supersedes:** the binary `expenses.settled_at` flag (migration 0011) as the
> *source of truth* for whether an expense is settled. Status is now **derived** from
> per-expense settlements (see §2.3, §6). The column is kept for back-compat and
> manual override only. Also extends [roadmap/phase-7-realtime-sync.md](../roadmap/phase-7-realtime-sync.md).
>
> **Status:** Specification. No code written. New migrations are apply-by-hand
> ([migrations-applied-manually](../roadmap/README.md#prerequisites)).

---

## 1. Overview

The Activity Page is a single feed that answers "what happened and who owes whom",
plus per-expense settle-up:

1. **Notifications** — events the user should see:
   - **User added to a group** — "*{actor} added {member} to {group}*".
   - **Who owes whom (non-group expense)** — directed debts from ungrouped expenses.
   - **Who owes whom (group expense)** — directed debts within a group.
2. **Expense listing with settlement** — each expense row shows a **Settle Up** action
   for involved users, a **Settled / Not Settled / Partially settled** status, and,
   after a partial payment, the updated **remaining** amount.
3. **Data consistency** — expense status and remaining are **derived from one source**
   (`src/lib/balances.ts`) so the identical figure appears on the individual expense,
   the group summary, the non-group tracking, and this Activity Page.

### Key architectural change (why a new migration)

Today settlements are **member↔member** (`settlements.payer_id/receiver_id`,
optionally `group_id`) with **no expense link**, and per-expense "settled" is only the
binary `expenses.settled_at` flag. To support *per-expense partial settlement with a
tracked remaining*, we add **`settlements.expense_id`** (nullable) and derive
remaining per expense. See §6.

---

## 2. Data structures

Ids are UUIDs; money is integer **cents**. Existing rows (`expenses`,
`expense_splits`, `members`, `groups`, `settlements`) are defined in
[update_chat_feature.md §2.1](update_chat_feature.md#21-existing-reused-unchanged) —
not repeated here. This doc adds two things.

### 2.1 New — `settlements.expense_id` (migration `0018_expense_settlements.sql`)

```
Settlement       (settlements)                 -- existing table, one new column
  id            uuid   PK
  owner_id      uuid   → profiles.id
  payer_id      uuid   → members.id
  receiver_id   uuid   → members.id
  amount_cents  int    (> 0)
  currency      text
  note          text?
  group_id      uuid?  → groups.id
  expense_id    uuid?  → expenses.id            -- NEW: NULL = an overall settlement
  settled_at    timestamptz                     -- transfer date (NOT the 0011 flag)
```

- `expense_id NULL` → the existing **overall** member↔member settlement (unchanged
  behaviour, keeps working).
- `expense_id` set → an **expense-scoped** payment that reduces *that expense's*
  remaining.

### 2.2 New — `ActivityEvent` (migration `0019_activity.sql`)

A lightweight, append-only feed. Debt rows can be **derived** live from the balance
engine; discrete events (user-added-to-group) are **persisted** so they have a
timestamp and read/unread state.

```
ActivityEvent    (activity_events)
  id            uuid   PK   default gen_random_uuid()
  owner_id      uuid   → profiles.id             -- whose feed this belongs to
  type          text   check (type in ('member_added_to_group','settlement_recorded'))
  actor_id      uuid?  → profiles.id             -- who did it
  group_id      uuid?  → groups.id
  expense_id    uuid?  → expenses.id
  member_id     uuid?  → members.id              -- subject (e.g. the added member)
  amount_cents  int?                             -- for settlement events
  created_at    timestamptz not null default now()
  read_at       timestamptz?
  INDEX (owner_id, created_at desc)
```

> "Who owes whom" rows are **not** stored — they are computed on read from
> `computeLedger` / `groupLedger` (`src/lib/balances.ts`) so they can never drift from
> the actual balances. Only discrete happened-once events are persisted here.

### 2.3 Derived per-expense status (no new column)

Computed from `expenseMemberLedger()` (`src/lib/balances.ts`), extended to subtract
**expense-scoped settlements**:

```
owedTotal(E)     = Σ share_cents of E's non-payer splits              -- what others owe the payer
paidToDate(E)    = Σ amount_cents of settlements where expense_id = E.id
remaining(E)     = max(0, owedTotal(E) − paidToDate(E))               -- also 0 if expenses.settled_at set (manual override)

status(E) =
  remaining(E) === 0            → "Settled"
  paidToDate(E) === 0           → "Not Settled"
  otherwise (0 < remaining)     → "Partially settled"
```

---

## 3. State management

| Operation | Mechanism | Notes |
|---|---|---|
| Record a per-expense payment | `'use server'` `recordSettlement({..., expenseId})` → insert `settlements` with `expense_id` → `revalidatePath` | Extends existing `src/actions/settlements.ts` |
| Compute status/remaining | `expenseMemberLedger` + expense-scoped settlements | Derived on read; **never stored** |
| List activity | query `activity_events` + derived ledger rows | `src/lib/queries/activity.ts` (new) |
| Emit "member added to group" | insert `activity_events` inside the add-member action / DB trigger on `group_members` | One event per membership |
| Live refresh | `postgres_changes` on `settlements`, `activity_events`, `expense_splits` → `router.refresh()` | Reuses the Phase 7 `useRealtimeRefresh` pattern |

- Remaining is **recomputed everywhere from the same function**, so a partial payment
  updates the Activity row, the group summary, and the non-group list in one shot — no
  multi-write fan-out to keep in sync.

---

## 4. Notification triggers

| Trigger | Event / source | Display |
|---|---|---|
| Member added to a group | `group_members` insert → `activity_events(type='member_added_to_group')` | "*{actor} added {member} to {group}*" |
| Who-owes-whom, non-group | derived: `computeLedger` over `group_id IS NULL` rows | directed debt lines |
| Who-owes-whom, group | derived: `groupLedger(groupId)` | directed debt lines, per group |
| Settlement recorded (optional) | `settlements` insert → `activity_events(type='settlement_recorded')` | "*{payer} paid {receiver} {amount}*" |

---

## 5. Settlement workflow (per expense)

1. On an expense row (Activity Page, group expenses, or non-group list) an involved
   user taps **Settle Up**.
2. They enter an amount (default = their `remaining` on that expense). Action inserts a
   `settlements` row with `expense_id`, `payer_id`, `receiver_id`, `amount_cents`.
3. `remaining(E)` is recomputed:
   - reaches **0** → status flips to **Settled** everywhere the expense appears.
   - **partial** → status is **Partially settled**; the reduced `remaining` shows on
     the Activity row, the Group Expenses summary, and the Non-Group Expenses list —
     all reading the same derived figure.
4. Deleting the settlement (`deleteSettlement`) restores the remaining — reversible,
   because nothing was stored as a snapshot.

---

## 6. Schema / migration (apply by hand)

### `0018_expense_settlements.sql`
```sql
alter table public.settlements
  add column if not exists expense_id uuid references public.expenses(id) on delete cascade;
create index if not exists idx_settlements_expense_id on public.settlements (expense_id);
comment on column public.settlements.expense_id is
  'NULL = overall member↔member settlement (legacy). Set = payment scoped to one '
  'expense; per-expense remaining subtracts these. Status derived, not stored.';
-- RLS unchanged: settlements remain owner_id = auth.uid(); expense_id is the owner''s own expense.
```

### `0019_activity.sql`
```sql
create table public.activity_events (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id),
  type         text not null check (type in ('member_added_to_group','settlement_recorded')),
  actor_id     uuid references public.profiles(id),
  group_id     uuid references public.groups(id) on delete cascade,
  expense_id   uuid references public.expenses(id) on delete cascade,
  member_id    uuid references public.members(id) on delete cascade,
  amount_cents int,
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);
create index idx_activity_owner_created on public.activity_events (owner_id, created_at desc);
alter table public.activity_events enable row level security;
create policy activity_own on public.activity_events
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
```
> After applying: **enable Realtime on `settlements` and `activity_events`**.

---

## 7. Data consistency (the required guarantee)

One derived source, four surfaces:

| Surface | Reads |
|---|---|
| Individual expense record | `expenseMemberLedger(E)` − expense-scoped settlements |
| Group expense summary | `groupMemberStats` / `groupLedger` (same rows, group-scoped) |
| Non-group expense tracking | `computeLedger` over `group_id IS NULL` rows |
| Activity Page | the same derived `remaining(E)` + persisted events |

Because remaining/status are **computed, not stored**, they cannot diverge across
these four surfaces — a single settlement insert changes the inputs once and every
surface recomputes identically. The binary `expenses.settled_at` remains only as a
manual "force settled" override that also zeroes remaining.

---

## 8. Edge cases

- **Overpayment** (amount > remaining) → clamp to remaining or reject; never negative.
- **Partial then full** → two settlements; remaining hits 0 → Settled.
- **Delete a settlement** → remaining restored; status recomputes (reversible).
- **Member removed from expense** (Phase 3) after a partial payment → recompute
  owedTotal on the new split set; guard the remaining doesn't go negative.
- **Manual `settled_at` set** while a positive derived remaining exists → manual
  override wins (status Settled, remaining 0); surface the discrepancy in the UI.
- **Non-group vs group** double counting → a group expense appears only in group
  ledgers; a `group_id IS NULL` expense only in non-group — `restrictToGroup` enforces
  the split.
- **Activity feed for removed group/expense** → cascade-delete events.

---

## 9. Testing

- **Unit (vitest):** extend `tests/unit/balances.test.ts` for `remaining(E)` with 0 /
  partial / full expense-scoped settlements and the manual-override case.
- **RLS (manual):** `activity_events` and `settlements` are owner-scoped;
  `expense_id` settlements only reference the owner's expenses.
- **Consistency:** record a partial settlement; assert the identical remaining shows on
  the expense detail, the group summary, the non-group list, and the Activity row.
- **Realtime:** two browsers — a settlement in one updates the Activity feed + status
  in the other.

---

## Shared Contracts (authoritative — identical in [update_chat_feature.md](update_chat_feature.md))

| Contract | Value |
|---|---|
| Expense id | `expenses.id` (uuid) |
| Group id | `groups.id` (uuid) |
| Person (split unit) | `members.id`; account link = `members.linked_user_id` → `profiles.id` |
| Chat entity | `messages` keyed by `messages.expense_id` (Doc 1, `0017`) |
| Settlement entity | `settlements` + **new** `settlements.expense_id` (this doc, `0018`) |
| Per-expense status vocabulary | **`Settled`** / **`Not Settled`** / **`Partially settled`** |
| Status derivation | `remainingCents === 0` → Settled; `paidToDate === 0` → Not Settled; `0 < remaining < owed` → Partially settled |
| Balance source of truth | `src/lib/balances.ts` (`expenseMemberLedger`, `computeLedger`, `groupLedger`) — derive-on-read |
| Money | integer cents; single account currency (`profiles.preferred_currency`) |
| Migration numbering | `0017` chat (Doc 1), `0018` expense settlements (this doc), `0019` activity (this doc) |

## Sync Audit — this doc vs. [update_chat_feature.md](update_chat_feature.md)

- **Data structures align:** this doc reuses Doc 1's `expenses`/`members`/`groups`
  definitions verbatim and adds only `settlements.expense_id` + `activity_events`.
  Doc 1's new `messages` table is disjoint from these — no overlap, no redefinition.
- **Identifiers align:** both anchor on `expenses.id`; both use
  `members.linked_user_id` as the "has an account" test; both use `groups.id`.
- **Status vocabulary aligns:** the `Settled` / `Not Settled` / `Partially settled`
  triad and its `remainingCents` derivation are stated identically in both docs'
  Shared-Contracts tables.
- **State management aligns:** both use server-action writes + `revalidatePath` and an
  additive realtime layer over RLS; this doc's `useRealtimeRefresh` reuse matches Doc
  1's realtime approach and roadmap Phase 7.
- **Non-contradiction:** Chat (Doc 1) never touches money; settlement/remaining (this
  doc) is the sole mutator of expense status. The two share only the `expense_id`
  anchor, so they compose without conflict.
- **Migration numbering is non-overlapping:** `0017` (chat), `0018` (expense
  settlements), `0019` (activity) — each apply-by-hand, sequential after the existing
  `0016`.
- **Supersession recorded:** this doc overrides the binary `expenses.settled_at` as
  the status source of truth (kept as manual override); Doc 1 overrides
  `roadmap/phase-6-chat.md`. Both are flagged in each file's header.
