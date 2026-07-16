# Phase 6 — Real-time chat (friends only)

**Goal:** Real-time text + emoji chat, enabled only between users whose profiles exist
and who are **accepted friends**.

**Status:** Not started. Depends on Phases 4/5 (accepted-friendship state) and
migration **0017**. This is the first phase to use Supabase realtime.

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

- [ ] Migration 0017 applied; Realtime enabled on `messages`.
- [ ] Friends can chat live (text + emoji); messages persist.
- [ ] Non-friends cannot open or post to a conversation (RLS-enforced).
- [ ] Optimistic send + realtime echo dedupe cleanly; ordering stable.
- [ ] Bodies rendered as text (no XSS); length cap enforced.
