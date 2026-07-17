# Phase 6 — Real-time chat (friends only)

> ⚠️ **SUPERSEDED by [docs/update_chat_feature.md](../docs/update_chat_feature.md).**
> Chat was rebuilt as **per-expense** (one isolated thread per group/non-group
> expense, keyed by `messages.expense_id`, gated by expense participation) — NOT
> friend-to-friend DMs. The friend-DM implementation described below was removed. See
> that doc and [[migration-0017-chat-pending]] for the live model; this file is kept
> for history only.

**Goal (original, superseded):** Real-time text + emoji chat, enabled only between
users whose profiles exist and who are **accepted friends**.

**Status:** **SUPERSEDED — the friend-DM build was replaced by per-expense chat.** The
original friend-DM notes below no longer describe the shipped feature. The earlier
friend-DM `0017_chat.sql` was applied to the live DB; the replacement
`0017_expense_chat.sql` DROPS it and creates the expense-keyed schema (apply by hand).
Original notes retained for history:

<!-- historical (superseded) -->
This was
first phase to use Supabase realtime.

> **Bug caught during verification (fixed):** a plpgsql function `returns <table
> type>` that returns SQL `NULL` comes back through PostgREST as an **all-null object**
> (`{ id: null, … }`), not JSON `null`. So `send_message`'s blocked path is guarded on
> `!row || !row.id`, not `!row` — otherwise a blocked send would read as success with a
> null-body message. (Scalar-returning RPCs like `get_or_create_conversation` return a
> proper `null`.)

> **Decisions taken at build time:**
> - **Writes go through SECURITY DEFINER RPCs.** `send_message` (find-or-create
>   conversation + insert + return row) and `get_or_create_conversation` were added to
>   0017 so message sending is atomic, race-safe on first-open from both sides, and
>   sidesteps this project's documented INSERT…RETURNING/RLS interaction (0009). The
>   friendship-gated RLS from the plan is kept verbatim — it governs every direct read
>   and the realtime subscription.
> - **Realtime enabled via SQL.** 0017 adds `messages` to the `supabase_realtime`
>   publication (equivalent to the dashboard Database → Replication toggle) so enabling
>   it is reproducible, not a manual click.
> - **Presence / typing indicators dropped** for this phase (they were optional in the
>   plan) — deferred to keep Phase 6 focused on live send/receive.
> - **Unread badges deferred.** `messages.read_at` is added to the schema but unused;
>   the nav Chat item carries no badge yet (a future unread-indicator feature).

---

## Context

Chat is fully greenfield — no `messages` table, component, or realtime code exists
today. The browser client `src/lib/supabase/client.ts` is realtime-capable but
currently unused. "Friend" = reciprocal linked members / an accepted invitation
(locked decision), so chat gating reuses that relationship.

## Technical approach

1. **Persistence + gating (migration 0017).** `conversations` (or a canonical pair
   key derived from the two profile ids) + `messages`. RLS: a user may SELECT/INSERT a
   message only if an **accepted friendship** exists between the two accounts — via a
   SECURITY DEFINER helper `are_friends(a, b)` that checks reciprocal linked members /
   accepted invitations.
2. **Send path.** A server action `src/actions/chat.ts` performs the INSERT so RLS +
   validation run server-side; the INSERT is what triggers the realtime event for both
   clients. Body is text/emoji only (emoji are just Unicode — no special handling; cap
   length, render as text never HTML).
3. **Live receive.** A Client Component chat panel subscribes via
   `src/lib/supabase/client.ts` to `postgres_changes` INSERT on `messages` filtered by
   `conversation_id`. Optional Supabase **Presence** for online/typing indicators.
4. **Verify auth on the socket.** Confirm the browser client carries the auth session
   to the realtime socket so RLS applies to the subscription (token propagation check).

## Files to change

- **Create:** `src/app/(app)/chat/` (list + `[friendId]` thread),
  `src/components/chat/**`, `src/actions/chat.ts`, `src/lib/queries/chat.ts`,
  `supabase/migrations/0017_chat.sql`.
- **Edit:** `src/lib/supabase/client.ts` if session wiring to the realtime socket
  needs adjustment; `src/components/layout/nav-config.ts` (Chat entry point);
  `src/types/database.types.ts` + `db.ts` (hand-sync).
- **Reuse:** friend/relationship queries from Phase 4; browser client channel API.

## Schema / migration — `0017_chat.sql` (apply by hand; enable Realtime on `messages`)

```sql
create table conversations (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid not null references profiles(id),
  user_b     uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  check (user_a < user_b),               -- canonical ordering, one row per pair
  unique (user_a, user_b)
);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null references profiles(id),
  body            text not null check (char_length(body) between 1 and 2000),
  created_at      timestamptz not null default now(),
  read_at         timestamptz
);
create index on messages (conversation_id, created_at);

-- Accepted-friendship gate
create or replace function are_friends(a uuid, b uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from members m
    where m.owner_id = a and m.linked_user_id = b
  ) and exists (
    select 1 from members m
    where m.owner_id = b and m.linked_user_id = a
  );
$$;

alter table conversations enable row level security;
alter table messages enable row level security;

create policy conversations_rw on conversations
  for all to authenticated
  using ((auth.uid() = user_a or auth.uid() = user_b) and are_friends(user_a, user_b))
  with check ((auth.uid() = user_a or auth.uid() = user_b) and are_friends(user_a, user_b));

create policy messages_rw on messages
  for all to authenticated
  using (exists (
    select 1 from conversations c
    where c.id = messages.conversation_id
      and (auth.uid() = c.user_a or auth.uid() = c.user_b)
      and are_friends(c.user_a, c.user_b)))
  with check (sender_id = auth.uid() and exists (
    select 1 from conversations c
    where c.id = messages.conversation_id
      and (auth.uid() = c.user_a or auth.uid() = c.user_b)
      and are_friends(c.user_a, c.user_b)));
```

> After applying: **enable Realtime on the `messages` table** in the Supabase
> dashboard (Database → Replication), otherwise subscriptions receive nothing.

## Edge cases

- Chatting with a **non-friend** → blocked by RLS + hidden in UI.
- **Unfriended mid-conversation** → `are_friends` flips false; freeze the thread
  (read-only) rather than error.
- **Long messages / spam** → length cap + basic rate limiting in the action.
- **Ordering & optimistic send** → dedupe the realtime echo against the optimistic
  message (client id / created_at).
- **Offline recipient** → message persists, delivered on next load.
- **XSS** → render body as text, never HTML.

## Testing

- **RPC/RLS (manual, two accounts):** friends can exchange messages; a non-friend
  INSERT/SELECT is denied; unfriending freezes the thread.
- **Realtime:** two browser sessions — a message sent in one appears live in the other
  without refresh; verify the socket carries auth (no leakage across conversations).
- **Manual:** emoji render correctly; optimistic send reconciles with the echo; long
  message rejected.

## Done when

- [x] Migration 0017 applied; Realtime enabled on `messages`. *(Applied by hand; the
      migration `alter publication`s `messages` into `supabase_realtime`, so no separate
      dashboard toggle was needed — realtime delivery confirmed in the E2E test.)*
- [x] Friends can chat live (text + emoji); messages persist. *(Send action →
      `send_message` insert persists; a subscribed friend received a live INSERT.)*
- [x] Non-friends cannot open or post to a conversation (RLS-enforced). *(Verified: an
      outsider's open/send returned null and their message read returned 0 rows; the
      thread query returns null so the page shows an unavailable state.)*
- [x] Optimistic send + realtime echo dedupe cleanly; ordering stable. *(Pure
      `mergeMessage`/`replaceMessage`/`sortMessages` in `src/lib/chat.ts`, unit-tested.)*
- [x] Bodies rendered as text (no XSS); length cap enforced. *(Rendered via `{body}`,
      never HTML; `char_length` check + `isSendableBody` cap at 2000.)*

**Verified end-to-end** via a seeded service-role test — DB gating (RLS + `are_friends`
+ the open/send RPCs), canonical-conversation dedupe, unfriend-freeze, and live
realtime delivery all pass. Remaining nicety for a future phase: a two-browser UI pass
for the optimistic-send feel. See [[migration-0017-chat-pending]].
