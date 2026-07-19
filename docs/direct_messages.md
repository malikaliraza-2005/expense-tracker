# Direct Messages — one-to-one chat between connected accounts

> **Status:** **Phase 1 (DM core) + Phase 2 (typing indicators) — code complete,
> pending migration + live E2E.** Apply `supabase/migrations/0029_direct_messages.sql`
> then `0030_typing_authorization.sql` by hand in the Supabase SQL editor (migrations
> here are apply-by-hand). 0030 also needs Realtime Authorization enabled on the
> project. See the Phase 2 section at the end for the typing-indicator design.
>
> **Relationship to existing chat:** this does **not** touch per-expense chat
> (`messages` / `can_chat_expense`, migration 0017). That stays exactly as it is. DMs
> are a **separate** surface: a second `dm_*` schema keyed by a *pair of accounts*
> rather than by an expense. The two share the pure ordering/validation engine in
> `src/lib/chat.ts` and nothing else.

---

## 1. Overview

A user can hold a private one-to-one conversation with any account they are
**connected** to. Messages persist, sync in real time to both sides, and each
conversation has a single shared thread — never a per-user duplicate.

| Capability | How |
|---|---|
| Entry on the home page | A **Messages** card on `/dashboard` (recent conversations + unread badge) |
| Dedicated surface | `/messages` (conversation list) and `/messages/[threadId]` (a thread) |
| One shared thread per pair | Canonical `(user_a < user_b)` + unique constraint on `dm_threads` |
| Persistence + history | `dm_messages`, read oldest-first on open |
| Real-time sync | `postgres_changes` INSERT on `dm_messages`, filtered by `thread_id` |
| Read state | `dm_reads` per-user watermark → unread counts / badges |

### Who can DM whom

Only **connected accounts** — a `members` row links the two either direction
(`owner_id = me ∧ linked_user_id = them`, or the reverse). This is the same
"connected account" test `log_activity` uses (migration 0018). It is a deliberate
security choice: it keeps DMs from becoming an unsolicited-message channel to any uuid
an attacker learns (0015/0023 hand out member/participant uuids legitimately), and it
leans on the existing friend rail rather than the `find_profile_by_email` oracle that
0028 locked down.

---

## 2. Data structures (migration 0029)

All ids are UUIDs. Bodies are plain text 1–2000 chars (emoji are Unicode), rendered as
text — never HTML — so there is no XSS surface, mirroring per-expense chat.

```
DmThread          (dm_threads)
  id          uuid  PK
  user_a      uuid  → profiles.id   ─┐ canonical pair: user_a < user_b (CHECK)
  user_b      uuid  → profiles.id   ─┘ UNIQUE (user_a, user_b)
  created_at  timestamptz

DmMessage         (dm_messages)
  id          uuid  PK
  thread_id   uuid  → dm_threads.id (cascade)   -- the isolation key
  sender_id   uuid  → profiles.id               -- an ACCOUNT
  body        text  check (char_length between 1 and 2000)
  created_at  timestamptz
  INDEX (thread_id, created_at)

DmRead            (dm_reads)
  thread_id     uuid  → dm_threads.id (cascade)
  user_id       uuid  → profiles.id  (cascade)
  last_read_at  timestamptz
  PK (thread_id, user_id)
```

### Why the canonical pair matters

"One conversation per pair" is **structural**, not an app convention. If the app merely
"looked for a thread and inserted one if missing", two people messaging each other for
the first time simultaneously would race and create two parallel threads — each talking
into their own copy. Instead the pair is stored sorted (`least`/`greatest`) with a
unique constraint, so a duplicate is *unrepresentable* and `get_or_create_dm_thread`
defers to the constraint via `on conflict do nothing` + re-select.

---

## 3. Authorization — all in the database

A Server Action is **not** a trust boundary (migration 0028): PostgREST exposes these
tables to any user's JWT. Every rule lives in SQL.

| Concern | Mechanism |
|---|---|
| Only connected accounts can open a DM | `is_connected_to(p_other)` — SECURITY DEFINER, **single-argument** (caller from `auth.uid()`, never trusted from an argument) |
| Thread created only by the RPC | No INSERT policy on `dm_threads`; `get_or_create_dm_thread` (DEFINER) is the sole writer |
| Only participants read/post | `can_access_dm_thread(p_thread)` gates `dm_messages` / `dm_reads` policies |
| You send only as yourself | `dm_messages_insert` check pins `sender_id = auth.uid()` |
| Your own read watermark only | `dm_reads` policies pin `user_id = auth.uid()` |

Lessons applied from prior migrations:

- **0028** — every new function is `revoke ... from public` + `from anon`, then
  `grant ... to authenticated`. A fresh `create function` grants EXECUTE to PUBLIC by
  default (anon ∈ PUBLIC), so `grant to authenticated` alone would add nothing.
- **0028** — `is_connected_to` is single-argument so it can never be an oracle probing
  whether two *strangers* know each other; it only ever answers about the caller.
- **0009** — no `INSERT ... RETURNING` inside the RPC (that form trips 42501 on this
  project even inside a DEFINER function); insert, then `SELECT` the row back.
- **0010/0023** — the access check lives in a SECURITY DEFINER helper so
  `dm_messages`' policy never re-enters `dm_threads`' policy (RLS recursion).
- **Access is by thread membership, not current connection.** A conversation stays
  readable if the two people later unlink — you don't lose your history.

### RPCs

| Function | Security | Returns | Notes |
|---|---|---|---|
| `is_connected_to(uuid)` | DEFINER | bool | caller ↔ p_other linked either direction |
| `can_access_dm_thread(uuid)` | DEFINER | bool | caller is one of the thread's two accounts |
| `get_or_create_dm_thread(uuid)` | DEFINER | uuid \| null | the only writer of `dm_threads`; null when not connected — **indistinguishable from "no such account"** |
| `list_dm_threads()` | INVOKER | table | conversation list w/ last message + unread; RLS scopes it (a convenience read, not an authorization boundary) |

---

## 4. Display names

Profiles are **self-only readable** (0010 dropped `profiles_select_shared`; 0015
confirms it as deliberate), so a partner's display name can **only** come from the
current user's own `members` roster via `linked_user_id → members.name` — exactly as
`queries/chat.ts` resolves expense-chat sender names. A partner not in your roster under
a name falls back to a generic label. Names are therefore never joined server-side from
`profiles`.

---

## 5. State management & real-time

Consistent with the app: server-action writes + `revalidatePath`, realtime added only
for the live thread.

| Operation | Mechanism |
|---|---|
| Open/reuse a thread | `openDmThread` → `get_or_create_dm_thread` RPC → navigate |
| Post a message | `sendDirectMessage` → RLS-gated INSERT (fans out via realtime) |
| Receive live | `dm-thread.tsx` subscribes to `dm_messages` INSERTs filtered `thread_id=eq.<id>` after `realtime.setAuth` |
| Mark read | `markDmRead` upserts `dm_reads` watermark |
| List stays live | `conversations-realtime.tsx` — scoped INSERT subscription + debounced `router.refresh()` |

`dm_messages` is deliberately **not** added to the app-wide `RealtimeSync` table set — a
full `router.refresh()` on every message everywhere would be wasteful. The thread
component subscribes to its own thread directly (the `messages` per-expense pattern),
and the list page mounts its own scoped listener.

Optimistic send + realtime echo reconcile through the **shared** engine in
`src/lib/chat.ts` (`mergeMessage`/`sortMessages`/`replaceMessage`), which was made
generic over `{ id, createdAt }` so both `ChatMessage` and `DirectMessage` use it — one
source of truth for ordering and de-duplication, no duplication.

---

## 6. Files

**New**
- `supabase/migrations/0029_direct_messages.sql` — schema, RLS, RPCs, realtime
- `src/lib/dm.ts` — pure DM helpers (+ re-exports of the shared body rules)
- `tests/unit/dm.test.ts` — pure-logic tests
- `src/lib/queries/dm.ts` — `getConversations`, `getDmThread`, `getDmCandidates`
- `src/actions/dm.ts` — `openDmThread`, `sendDirectMessage`, `markDmRead`
- `src/app/(app)/messages/page.tsx` + `loading.tsx` — conversation list
- `src/app/(app)/messages/[threadId]/page.tsx` — a thread
- `src/components/messages/dm-thread.tsx` — realtime thread client
- `src/components/messages/start-dm-dialog.tsx` — "new message" picker
- `src/components/messages/conversations-realtime.tsx` — scoped list refresher
- `src/components/dashboard/messages-card.tsx` — home-page entry point

**Changed**
- `src/lib/chat.ts` — ordering/merge helpers made generic (backward-compatible)
- `src/types/{database.types.ts,db.ts,dto.ts}` — DM tables, RPCs, DTOs
- `src/constants/routes.ts` — `messages` / `messageThread`
- `src/app/(app)/dashboard/page.tsx` — mount the Messages card

---

## 7. Edge cases

- **Both send the first message at once** → one thread (unique pair constraint; the RPC
  re-selects the winner).
- **Not connected / no such account** → `openDmThread` returns the same "can only
  message people you're connected with" error; the two are indistinguishable by design.
- **Later unlink** → existing thread stays readable (access is thread membership).
- **Outsider opens `/messages/<id>` by guessing** → RLS returns no thread row → 404.
- **Direct RPC/table poke from a hostile JWT** → INSERT on `dm_threads` has no policy
  (denied); posting to a thread you're not on fails the RLS check (42501 → friendly
  error); a bogus `is_connected_to` argument can't lie about the caller.
- **Long / emoji-only / spam** → 1–2000 length cap + a 20-per-10s burst limit in the
  action, matching per-expense chat.
- **Offline sender** → optimistic bubble stays `pending`; on send failure it's rolled
  back and the text restored to the composer.
- **Account deleted** → threads/messages/reads cascade off `profiles`.

---

## 8. Testing

- **Pure (vitest):** `tests/unit/dm.test.ts` — row→DTO projection, name resolution,
  "You:" preview, unread rollup, and the shared ordering engine over `DirectMessage`.
- **RLS (manual, 2 accounts):** connected A/B can open one shared thread and both
  read/post; an unconnected C is refused `openDmThread` and can neither read nor post
  in A↔B; a message in thread T1 never appears in T2.
- **Realtime (2 browsers):** a post from A appears live on B; a post in a different
  thread does not arrive; unread badge clears when the thread is opened.
- **Race:** two simultaneous `get_or_create_dm_thread(A,B)` return the same id.

---

## Phase 2 — Live typing indicators (built — pending migration 0030 + live E2E)

Adds "X is typing…" to **both** DMs and per-expense chat, in real time, clearing when
the person stops.

**Mechanism — Realtime Broadcast on a *dedicated private* channel** (not a DB table —
typing is ephemeral and never persists):

- Message delivery stays on the existing public channels (`dm-thread:<id>` /
  `expense-chat:<id>`, postgres_changes). Typing runs on **separate** channels
  `dm-typing:<id>` / `expense-typing:<id>` marked `{ private: true }`. Isolating typing
  means a typing-authorization problem can never degrade message delivery.
- **Authorization (migration `0030_typing_authorization.sql`).** Private channels make
  Realtime check RLS on `realtime.messages` (which denies all private channels by
  default). 0030 adds SELECT (receive) + INSERT (send) policies that call
  `can_receive_typing(topic)` — which parses the id from the topic and reuses the
  existing gates (`can_access_dm_thread` for DMs, `can_chat_expense` for per-expense).
  So only real participants can send or see typing; it fails closed on any unknown
  prefix or malformed id. `realtime.setAuth` (already called before subscribe in both
  chat clients) supplies the JWT. This is the codebase's first use of `broadcast`.
- **No name in the payload.** Only the sender's `userId` is broadcast; the receiver
  resolves it to *their own* roster name (names are roster-relative everywhere else). So
  the hook tracks ids and each surface maps them — DMs to the one known partner,
  per-expense chat to its `senderNames`.
- **Timing.** On each keystroke `notifyTyping` re-announces at most every 2s; after 3s
  idle it broadcasts `stop`. Receivers auto-expire a typer after 5s (> the 2s re-announce
  so it never flickers), and drop them instantly on `stop` or when their message arrives.
- **Shared implementation.** `src/hooks/use-typing-indicator.ts` (the channel + timing) +
  `src/components/common/typing-indicator.tsx` (the line) + pure `src/lib/typing.ts`
  (`describeTyping`, unit-tested) — one implementation, both surfaces (the same "reuse,
  don't duplicate" split as `lib/chat.ts`).

**Files added:** `supabase/migrations/0030_typing_authorization.sql`,
`src/lib/typing.ts` (+ `tests/unit/typing.test.ts`),
`src/hooks/use-typing-indicator.ts`, `src/components/common/typing-indicator.tsx`.
**Changed:** `dm-thread.tsx`, `expense-chat.tsx` (wire the hook + indicator),
`database.types.ts` (`can_receive_typing`).

**Graceful degradation:** if 0030 isn't applied (or Realtime Authorization is off), the
private typing channel simply fails to authorize and the hook stays inert — the
indicator doesn't show, and nothing else is affected. Same "pending migration + live
E2E" status as Phase 1.

**Edge cases handled:** sender goes offline mid-type (5s receive-expiry clears it);
several typers in a group expense ("Bob, Carol and Dee are typing…" → "Several people
are typing…"); the indicator never survives a sent message (`stop` on send) or a closed
tab (channel teardown on unmount); a blank/unknown roster name is dropped rather than
rendering " is typing…".

**Live E2E to run after applying 0030 (2 accounts):** connected A/B on the same DM —
A types, B sees "A is typing…" within ~1s; A stops, it clears within ~5s; A sends, it
clears immediately. Same on a shared expense thread. An outsider C (not a participant)
subscribing to the typing topic is refused by the `realtime.messages` policy.
