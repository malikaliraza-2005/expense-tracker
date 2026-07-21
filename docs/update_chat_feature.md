# Chat Feature Update — Group Page, Group Expenses & Per-Expense Chat

> **Companion doc:** [activity_page.md](activity_page.md). The two share one data
> contract — see the **Shared Contracts** and **Sync Audit** sections at the end;
> they must be read together.
>
> **Supersedes:** [roadmap/phase-6-chat.md](../roadmap/phase-6-chat.md). Chat is now
> **per-expense**, not friend-to-friend DMs. The friend-to-friend `conversations`
> model in Phase 6 is dropped in favour of the `messages(expense_id)` model below.
>
> **Status:** **Implemented (code complete) — pending migration + live E2E.** The
> Group Page is restored (UI/queries/actions on the live tables) and per-expense chat
> is built (`messages.expense_id`, `can_chat_expense`, realtime panel on Expense
> Detail). Apply `supabase/migrations/0017_expense_chat.sql` by hand — it also **drops
> the superseded friend-DM chat** objects an earlier build left on the live DB — then
> the seeded live E2E can run. New migrations are apply-by-hand
> ([migrations-applied-manually](../roadmap/README.md#prerequisites)). Doc 2
> ([activity_page.md](activity_page.md), migrations 0018/0019) is not yet built.

---

## 1. Overview

Three capabilities, built on the **existing** schema wherever possible:

1. **Group Page** — create and manage groups for shared expenses. The `groups` /
   `group_members` tables, `expenses.group_id`, and the group balance engine
   (`groupBalances`, `groupLedger`, `groupMemberStats`, `restrictToGroup` in
   `src/lib/balances.ts`) all still exist; Phase 2 removed only the UI. This is a
   **UI + query + action re-add on live tables** — no group schema change.
2. **Expenses in groups** — attach an expense to a group via the already-nullable
   `expenses.group_id`, so shared costs are tracked per group.
3. **Per-expense isolated chat** — each expense owns a private message thread. A
   message in expense A is never visible from expense B. New `messages` table keyed
   by `expense_id`, delivered in real time.

### What already exists vs. what is new

| Concern | Status | Where |
|---|---|---|
| `groups`, `group_members` tables | **Exists** | migration 0010 |
| `expenses.group_id` (nullable) | **Exists** | migration 0010 |
| Group balance engine | **Exists** | `src/lib/balances.ts` |
| Group Page UI / routes / queries / actions | **Deleted (Phase 2)** → rebuild | `roadmap/phase-2-remove-people-groups.md` |
| `/groups` route | **307 → `/expenses`** → restore | `next.config.mjs` |
| Expense→group chat | **New** | migration `0017_expense_chat.sql` |

---

## 2. Data structures

All ids are UUIDs. Money is integer **cents**. Names below match the live schema so
both docs and the code agree.

### 2.1 Existing (reused unchanged)

```
Group            (groups)
  id            uuid   PK
  owner_id      uuid   → profiles.id          -- single-owner model (0010)
  name          text
  type          group_type  enum: trip|home|friends|couple|office|other
  created_at    timestamptz

GroupMember      (group_members)
  id            uuid   PK
  group_id      uuid   → groups.id  (cascade)
  member_id     uuid   → members.id
  joined_at     timestamptz
  UNIQUE (group_id, member_id)

Expense          (expenses)
  id            uuid   PK
  owner_id      uuid   → profiles.id
  group_id      uuid?  → groups.id            -- NULL = a general (non-group) expense
  title         text
  amount_cents  int    (>= 0)
  currency      text
  category_id   int    → categories.id
  expense_date  date
  paid_by       uuid   → members.id           -- single payer, equal-split model
  settled_at    timestamptz?                  -- 0011 manual flag (see Sync Audit)
  created_at    timestamptz

ExpenseSplit     (expense_splits)
  id            uuid   PK
  expense_id    uuid   → expenses.id (cascade)
  member_id     uuid   → members.id
  share_cents   int    (>= 0)
  UNIQUE (expense_id, member_id)

Member           (members)
  id            uuid   PK
  owner_id      uuid   → profiles.id
  name          text
  email         text?
  linked_user_id uuid? → profiles.id          -- set once this person claims an account
  is_self       bool
```

### 2.2 New — `ExpenseMessage` (migration `0017_expense_chat.sql`)

```
ExpenseMessage   (messages)
  id            uuid   PK   default gen_random_uuid()
  expense_id    uuid   → expenses.id (cascade)   -- the ISOLATION KEY: one thread per expense
  sender_id     uuid   → profiles.id             -- an ACCOUNT (not a member row)
  body          text   check (char_length(body) between 1 and 2000)  -- text + emoji (Unicode)
  created_at    timestamptz not null default now()
  INDEX (expense_id, created_at)
```

- **Isolation** is structural: every read is `where expense_id = $1`. There is no
  cross-expense query path, so thread A can never leak into thread B.
- `sender_id` is a **profile** (a real account), because only account-holders can
  post. A name-only member with no `linked_user_id` cannot chat.
- `body` is stored and rendered as **plain text** (emoji are Unicode) — never HTML.

### 2.3 Who may post — the participant gate

The set of accounts allowed to read/post in expense `E`:

```
allowed(E) = { E.owner_id }
           ∪ { m.linked_user_id
               : m ∈ members, m.linked_user_id IS NOT NULL,
                 m.id ∈ ( E.paid_by ∪ { s.member_id : s ∈ expense_splits, s.expense_id = E.id } ) }
```

i.e. the owner plus every **linked account** of a member who participates in the
expense (payer or split). This reuses the `members.linked_user_id` rail from
migrations 0014/0016 and the cross-user read policy from 0015.

---

## 3. State management

Consistent with the existing app pattern (server actions + `revalidatePath`; no
SWR/react-query), with realtime added only for the chat thread.

| Operation | Mechanism | Notes |
|---|---|---|
| Create/rename/delete group | `'use server'` action → insert/update/delete on `groups`/`group_members` → `revalidatePath` | Re-add of the Phase-2-deleted `src/actions/groups.ts` |
| Add expense to group | existing `create_expense_with_splits` RPC with `p_group_id` | Already supports `group_id` (0010) |
| Read group balances | `groupMemberStats` / `groupLedger` over fetched rows | `src/lib/balances.ts`, unchanged |
| Post a chat message | `'use server'` `sendExpenseMessage` → insert into `messages` (RLS-gated) | Insert triggers the realtime event |
| Receive messages live | Browser client `postgres_changes` INSERT on `messages`, filtered `expense_id=eq.<id>` | `src/lib/supabase/client.ts` (realtime-capable, currently unused) |

- **Writes go through the server** so RLS + validation run server-side; the DB INSERT
  is what fans the message out to both clients via realtime.
- **Realtime must be enabled on `messages`** in the Supabase dashboard (infra toggle,
  separate from code).
- Optimistic send reconciles against the realtime echo (dedupe on a client id /
  `created_at`).

---

## 4. User workflows

### 4.1 Create & manage a group
1. User opens **Group Page** (`/groups`, restored) → "New group" → name + type.
2. Add members (owner's `members`) to the group → `group_members` inserts.
3. Group detail shows the group's expenses and `groupLedger` who-owes-whom.

### 4.2 Add an expense to a group
1. From the group (or the expense form's scope picker, restored) choose a group.
2. Create the expense with `group_id` set → equal-split across group members.
3. Group summary and balances update via the derive-on-read engine.

### 4.3 Open an expense → isolated chat
1. Expense Detail shows a **Chat** panel for that expense only.
2. Allowed accounts (§2.3) post text/emoji; others see it read-only or hidden.
3. Messages arrive live; the thread is scoped to `expense_id` and shares nothing with
   any other expense.

---

## 5. Integration points

- **Group ↔ Expense:** `expenses.group_id`. A group expense participates in group
  balances (`restrictToGroup`); a non-group expense (`group_id IS NULL`) does not.
- **Expense ↔ Chat:** `messages.expense_id` (1 expense → many messages). Deleting an
  expense cascades its messages.
- **Chat ↔ Accounts:** posting gated by `members.linked_user_id` (the friend/claim
  rail). No account → no posting.
- **Expense ↔ Settlement/Activity (Doc 2):** the same expense is the anchor for
  per-expense settlement and Activity events. Doc 2 adds `settlements.expense_id`
  referencing this same `expenses.id`. **Chat does not affect balances** — it is a
  communication layer only.

---

## 6. Schema / migration — `0017_expense_chat.sql` (apply by hand)

```sql
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  expense_id  uuid not null references public.expenses(id) on delete cascade,
  sender_id   uuid not null references public.profiles(id),
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index idx_messages_expense_created on public.messages (expense_id, created_at);

alter table public.messages enable row level security;

-- Read/post only if you are the owner or a linked participant of the expense.
create or replace function public.can_chat_expense(p_expense uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.expenses e where e.id = p_expense and e.owner_id = auth.uid()
  ) or exists (
    select 1
    from public.expenses e
    join public.expense_splits s on s.expense_id = e.id
    join public.members m       on m.id = s.member_id
    where e.id = p_expense and m.linked_user_id = auth.uid()
  );
$$;
grant execute on function public.can_chat_expense(uuid) to authenticated;

create policy messages_select on public.messages
  for select to authenticated using (can_chat_expense(expense_id));

create policy messages_insert on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and can_chat_expense(expense_id));
```
> After applying: **enable Realtime on `messages`** (Database → Replication).

**Group Page = no schema change** — restore UI/queries/actions on the live
`groups`/`group_members` tables.

---

## 7. Edge cases

- Message in a **non-group** expense → allowed; isolation is per `expense_id`
  regardless of `group_id`.
- Participant with **no account** (`linked_user_id` NULL) → can't post (gate).
- Participant **removed from the expense** (Phase 3 `removeExpenseMember`) → loses
  chat access on next check (gate is evaluated live).
- **Expense deleted** → messages cascade-deleted.
- **Long message / emoji-only / spam** → length cap (1–2000) + basic rate limit in the
  action; render as text (no XSS).
- **Group deleted** with expenses → decide cascade vs. detach (`group_id → NULL`);
  spec default: detach so expense + its chat survive.

---

## 8. Testing

- **RLS (manual, 2 accounts):** a participant's linked account can read/post; a
  non-participant account is denied; messages never appear under another expense.
- **Realtime:** two browsers on the same expense — a post appears live in both; a post
  on a different expense does **not** arrive.
- **Isolation:** query `messages` for expense A returns zero rows from expense B.
- **Group Page:** create group, add expense with `group_id`, verify `groupLedger`
  reflects it; `/groups` no longer redirects.

---

## Shared Contracts (authoritative — identical in [activity_page.md](activity_page.md))

These names/values are the single source of truth across both docs:

| Contract | Value |
|---|---|
| Expense id | `expenses.id` (uuid) |
| Group id | `groups.id` (uuid) |
| Person (split unit) | `members.id`; account link = `members.linked_user_id` → `profiles.id` |
| Chat entity | `messages` keyed by `messages.expense_id` |
| Chat sender | `messages.sender_id` → `profiles.id` (accounts only) |
| Settlement entity | `settlements` + **new** `settlements.expense_id` (Doc 2, `0018`) |
| Per-expense status vocabulary | **`Settled`** / **`Not Settled`** / **`Partially settled`** |
| Status derivation | from `expenseMemberLedger()` remaining: `remainingCents === 0` → Settled; `paidToDate === 0` (remaining === owed) → Not Settled; `0 < remaining < owed` → Partially settled |
| Balance source of truth | `src/lib/balances.ts` (derive-on-read; balances never stored) |
| Money | integer cents; single account currency (`profiles.preferred_currency`) |
| Migration numbering | `0017` chat (this doc), `0018` expense settlements, `0019` activity (Doc 2) |

## Sync Audit — this doc vs. [activity_page.md](activity_page.md)

- **Data structures align:** both docs reference the same `expenses`, `members`,
  `groups`, and `settlements` rows; the only new tables are `messages` (here) and the
  activity feed + `settlements.expense_id` (Doc 2). No column is defined two different
  ways.
- **Identifiers align:** both anchor on `expenses.id`; both use
  `members.linked_user_id` for "does this person have an account"; both treat
  `groups.id` as the group key.
- **Status vocabulary aligns:** `Settled` / `Not Settled` / `Partially settled` are
  defined once (above) and consumed identically by Doc 2's Activity list and
  settlement flow.
- **State management aligns:** both use server-action writes + `revalidatePath`;
  realtime is additive (`messages` here; Activity refresh in Doc 2) and both respect
  RLS.
- **Non-contradiction:** Chat is communication-only and **never** mutates balances;
  settlement/remaining (Doc 2) is the only thing that changes money state. The two
  concerns are orthogonal and share only the `expense_id` anchor.
- **Supersession recorded:** this doc overrides `roadmap/phase-6-chat.md` (friend
  DMs → per-expense threads); Doc 2 overrides the binary `expenses.settled_at` as the
  status source. Both supersessions are noted in each file's header so `roadmap/` and
  `docs/` do not silently disagree.
