# Database Design

Complete description of the relational schema: entities, relationships, constraints, and the Row Level Security (RLS) strategy. This document is the authoritative reference for the data model; phase files reference it rather than redefining it.

---

## 1. Entity–relationship overview

```
              friendships                              expenses
              (user_id, friend_id)                     (group_id?, paid_by,
                   ▲   ▲                                 created_by, category_id)
                   │   │                                    ▲   ▲   ▲
                   │   │        ┌───────────────────────────┘   │   │
        ┌──────────┴───┴────────┴──────┐                        │   │
        │           profiles           │◄───────────────────────┘   │
        │        (1:1 auth.users)      │◄── group_members.user_id    │
        └──────┬──────────────┬────────┘◄── expense_splits.user_id   │
               │              │         ◄── settlements.payer_id /    │
               │              │             receiver_id              │
               ▼              ▼                                       │
            groups ──────► group_members                             │
               │  \                                                  │
               │   └──────► expenses ──────► expense_splits          │
               │                                                     │
               └──────► settlements                     categories ──┘
```

`profiles` is the hub: nearly every other table references it. `groups` is a secondary hub for group-scoped data.

---

## 2. Tables

Conventions: all PKs are UUID unless noted; `created_at timestamptz default now()`; money stored as **integer minor units** (`*_cents`).

### 2.1 `profiles`
One row per user, 1:1 with `auth.users`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid **PK** | FK → `auth.users.id`; seeded by signup trigger |
| `full_name` | text | Display name |
| `avatar_url` | text | Supabase Storage path |
| `preferred_currency` | text | App uses a single currency; drives display |
| `created_at` | timestamptz | |

### 2.2 `friendships`
Directional friend links between registered users.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid **PK** | |
| `user_id` | uuid **FK** → `profiles.id` | The owner |
| `friend_id` | uuid **FK** → `profiles.id` | The friend |
| `status` | text | `accepted` for MVP |
| `created_at` | timestamptz | |

Constraints: `unique(user_id, friend_id)`; `check(user_id <> friend_id)`.

### 2.3 `groups`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid **PK** | |
| `name` | text | |
| `type` | `group_type` enum | Trip, Home, Friends, Couple, Office, Other |
| `created_by` | uuid **FK** → `profiles.id` | Owner |
| `created_at` | timestamptz | |

### 2.4 `group_members`
Join table: which users belong to which groups.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid **PK** | |
| `group_id` | uuid **FK** → `groups.id` | |
| `user_id` | uuid **FK** → `profiles.id` | |
| `role` | text | `owner` / `member` |
| `joined_at` | timestamptz | |

Constraints: `unique(group_id, user_id)`.

### 2.5 `categories`
Seeded lookup table (small, static).

| Column | Type | Notes |
|---|---|---|
| `id` | int **PK** | |
| `name` | text | Food, Transport, Shopping, Bills, Entertainment, Travel, Other |
| `icon` | text | Icon key for UI |

### 2.6 `expenses`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid **PK** | |
| `group_id` | uuid **FK** → `groups.id` | **Nullable** — null = personal / 1:1 expense |
| `title` | text | |
| `description` | text | Optional |
| `amount_cents` | int | Total, integer minor units |
| `currency` | text | Single app currency; retained for forward-compat |
| `category_id` | int **FK** → `categories.id` | |
| `expense_date` | date | |
| `paid_by` | uuid **FK** → `profiles.id` | The payer |
| `created_by` | uuid **FK** → `profiles.id` | Who recorded it |
| `receipt_url` | text | Optional (Storage) |
| `notes` | text | Optional |
| `created_at` | timestamptz | |

### 2.7 `expense_splits`
Per-person share of an expense — the source of truth for "who owes what".

| Column | Type | Notes |
|---|---|---|
| `id` | uuid **PK** | |
| `expense_id` | uuid **FK** → `expenses.id` | `on delete cascade` |
| `user_id` | uuid **FK** → `profiles.id` | Participant |
| `share_cents` | int | This user's share, integer |
| `split_type` | `split_type` enum | equal / exact / percentage |
| `created_at` | timestamptz | |

Invariant: `sum(share_cents) = expenses.amount_cents` for each expense.

### 2.8 `settlements`
Recorded payments between two users.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid **PK** | |
| `group_id` | uuid **FK** → `groups.id` | **Nullable** — null = personal settlement |
| `payer_id` | uuid **FK** → `profiles.id` | Who paid |
| `receiver_id` | uuid **FK** → `profiles.id` | Who received |
| `amount_cents` | int | |
| `currency` | text | Single app currency |
| `note` | text | Optional |
| `settled_at` | timestamptz | |

---

## 3. Relationships & cardinality

| Parent | Child | Cardinality | Foreign key(s) |
|---|---|---|---|
| profiles | friendships | 1 → many | `user_id`, `friend_id` |
| profiles | groups | 1 → many | `created_by` |
| profiles | group_members | 1 → many | `user_id` |
| groups | group_members | 1 → many | `group_id` |
| groups | expenses | 1 → many | `group_id` (nullable) |
| groups | settlements | 1 → many | `group_id` (nullable) |
| categories | expenses | 1 → many | `category_id` |
| profiles | expenses | 1 → many | `paid_by`, `created_by` |
| expenses | expense_splits | 1 → many | `expense_id` |
| profiles | expense_splits | 1 → many | `user_id` |
| profiles | settlements | 1 → many | `payer_id`, `receiver_id` |

---

## 4. Enums & constraints

| Type | Values |
|---|---|
| `group_type` | `trip`, `home`, `friends`, `couple`, `office`, `other` |
| `split_type` | `equal`, `exact`, `percentage` |

Key constraints:
- `friendships`: unique pair, no self-friend.
- `group_members`: unique `(group_id, user_id)`.
- `expense_splits`: `on delete cascade` from `expenses`; application-enforced sum invariant.
- Money columns are `int` (cents) with `check(amount_cents >= 0)` where appropriate.

---

## 5. Indexes

Add indexes on all foreign-key columns and common query paths:

- `expenses(group_id)`, `expenses(paid_by)`, `expenses(created_by)`, `expenses(expense_date)`
- `expense_splits(expense_id)`, `expense_splits(user_id)`
- `group_members(group_id)`, `group_members(user_id)`
- `settlements(group_id)`, `settlements(payer_id)`, `settlements(receiver_id)`
- `friendships(user_id)`, `friendships(friend_id)`

---

## 6. Balances: derived, not stored

Balances are **computed on read** in a typed TypeScript module, never persisted:

- A user's balance with another user = (what others owe them via `expense_splits` on expenses they paid) − (what they owe others) ± recorded `settlements`.
- Group balances aggregate the same source rows scoped to a `group_id`.
- Overall dashboard figures (you owe / you are owed / net) aggregate across all of a user's relationships.

Rationale: a single source of truth (`expense_splits` + `settlements`) cannot drift out of sync with a cached balance column. See [architecture.md](./architecture.md) §4.

---

## 7. Row Level Security strategy

RLS is the primary authorization boundary. Every table has RLS **enabled** with policies expressed in terms of `auth.uid()`.

| Table | Read policy (intent) | Write policy (intent) |
|---|---|---|
| `profiles` | Self; and profiles visible via shared groups/friendships | Self only (update) |
| `friendships` | Rows where the user is `user_id` or `friend_id` | User can create/remove their own links |
| `groups` | Groups the user is a member of | Members (owner) may edit/delete |
| `group_members` | Membership rows of the user's groups | Group owner manages membership |
| `expenses` | Expenses in the user's groups, or personal expenses involving them | Members of the group / participants |
| `expense_splits` | Splits of expenses the user can see | Written via the expense's owning action |
| `settlements` | Settlements where the user is payer/receiver or in the group | Participants |
| `categories` | Readable by all authenticated users | Not user-writable (seeded) |

Principles:
- **Deny by default.** No policy = no access. Policies grant the minimum.
- **Membership-scoped.** Group data is visible only to members; helper predicates check `group_members`.
- **Defense in depth.** Server Actions add their own checks, but RLS is the guarantee.
- **Storage mirrors tables.** Avatar/receipt storage policies match the owning row's access.

---

## 8. Signup trigger

On insert into `auth.users`, a trigger creates the matching `profiles` row (id, default `preferred_currency`, empty name to be completed in profile). This is the only trigger required for the MVP; balance logic stays in the application layer.

---

## 9. Referential integrity & deletion behavior

- Deleting an `expense` cascades to its `expense_splits`.
- Deleting a `group`: decide and document behavior (block if it has expenses, or cascade). Default recommendation: **block deletion** while expenses exist to protect history; require the group to be cleared/settled first.
- Removing a `group_member` does not delete their historical splits; balances remain accurate.

See [phases/phase-2-database-rls-balance-engine.md](./phases/phase-2-database-rls-balance-engine.md) for the implementation and verification plan.
