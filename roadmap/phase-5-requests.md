# Phase 5 — Requests page

**Goal:** One page with tabbed sections over the `invitations` table:
**Sent, Received, Accepted, Rejected, Clarifications.**

**Status:** Not started. Depends on Phase 4 (friend requests + migration 0016's
recipient RLS, `kind`, `rejected`/`clarifying` statuses).

> **Confirm before building:** *Clarifications* is the lightest-defined section. It's
> planned as a note thread on a queried request. If you'd rather route disputes
> through Phase 6 chat, drop this tab and the `invitation_notes` table.

---

## Context

All request state lives in the `invitations` table. Today RLS is inviter-only
(`invitations_all_own`), so recipients can't see anything — Phase 4's migration 0016
adds the recipient-visible SELECT policy and the `rejected`/`clarifying` statuses that
make this page possible.

## Technical approach

New route `src/app/(app)/requests/` (Server Component shell + client tabs). Tabs:

- **Sent** — `invitations` where `inviter_id = auth.uid()`.
- **Received** — invitations where `accepted_user_id = auth.uid()` or the recipient
  email matches the current user (needs the 0016 recipient RLS policy). Actions:
  **Accept** (`accept_invite`), **Reject** (`reject_invite`), **Ask a question**
  (→ Clarifications).
- **Accepted** — `status = 'accepted'`, either direction.
- **Rejected** — `status = 'rejected'`, either direction.
- **Clarifications** — requests the recipient neither accepted nor rejected but
  **queried**: a short back-and-forth note thread before deciding. Modeled as
  `status = 'clarifying'` + an `invitation_notes` table so both parties can add
  notes; the request stays actionable (accept/reject) from this tab.

Add a **Requests** nav item (`nav-config.ts`) with an unread/received badge count.
Lift the tab UI out of `src/components/groups/group-tabs.tsx` into a shared
`src/components/ui/tabs` **before** Phase 2 deletes it.

## Files to change

- **Create:** `src/app/(app)/requests/` (page + tabs),
  `src/components/requests/**`, `src/lib/queries/requests.ts`,
  `src/components/ui/tabs.tsx` (lifted from `group-tabs.tsx`).
- **Edit:** `src/actions/invite.ts` (add `rejectInvite`, `addInvitationNote`,
  `requestClarification`), `src/components/layout/nav-config.ts` (Requests item +
  badge), `src/types/database.types.ts` + `db.ts` (hand-sync `invitation_notes`).
- **Reuse:** `accept_invite` / `acceptInvite`, `reject_invite` (from 0016),
  invitations query patterns.

## Schema / migration — folds into `0016_friend_requests.sql`

The `'rejected'`/`'clarifying'` statuses and recipient RLS are in Phase 4's 0016.
Add the notes table there too:

```sql
create table invitation_notes (
  id            uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references invitations(id) on delete cascade,
  author_id     uuid not null references profiles(id),
  body          text not null check (char_length(body) between 1 and 1000),
  created_at    timestamptz not null default now()
);
alter table invitation_notes enable row level security;

-- Both parties to the invitation may read/insert notes
create policy invitation_notes_rw on invitation_notes
  for all to authenticated
  using (exists (
    select 1 from invitations i
    where i.id = invitation_notes.invitation_id
      and (i.inviter_id = auth.uid()
           or i.accepted_user_id = auth.uid()
           or lower(i.email) = lower((auth.jwt() ->> 'email')))
  ))
  with check (author_id = auth.uid());
```

## Edge cases

- A request to an email that **later registers** → match on registration / next
  session (recipient RLS keys on email + `accepted_user_id`).
- **Duplicate** requests → dedupe via the pending partial-unique index.
- **revoked vs rejected vs clarifying** — keep distinct; only pending/clarifying are
  actionable.
- Clarification thread on an **already-accepted/expired** request → read-only.
- Accepting a **friend** request creates the reciprocal linked member so both sides
  see each other as friends.
- Badge count must reflect only **actionable received** items.

## Testing

- **Unit:** status-transition helpers (pending→accepted/rejected/clarifying); badge
  count logic.
- **RPC/RLS (manual, two accounts):** recipient sees only their received requests;
  `reject_invite` and note insert respect party-only RLS; sender sees Sent updates.
- **Manual:** full round trip — send from account A, see Received on account B,
  accept/reject/clarify, confirm the tab + badge update on both sides.

## Done when

- [ ] `/requests` shows all five sections, correctly filtered by direction/status.
- [ ] Accept / Reject / Ask-a-question work with correct RLS.
- [ ] Clarifications thread persists and both parties can post (or the tab is dropped
      by decision).
- [ ] Requests nav item shows an actionable-received badge.
- [ ] Tab component lifted to `ui/` so Phase 2 can delete groups safely.
