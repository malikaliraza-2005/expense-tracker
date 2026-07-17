# Phase 5 — Requests page

**Goal:** One page with tabbed sections over the `invitations` table:
**Received, Sent, Accepted, Rejected.**

**Status:** **Code complete — pending migration 0016 + E2E verification.** Builds,
typechecks, and unit-tests green (`tests/unit/requests.test.ts`). Depends on Phase
4's migration 0016 (recipient RLS, `kind`, `rejected` status). Live behaviour of
the Received/Accepted/Rejected tabs and reciprocal linking is gated on **applying
0016 by hand** — until then the page degrades to Sent-only (no recipient policy →
no received rows), with no errors.

> **Decisions taken at build time:**
> - **Clarifications DROPPED.** The note-thread section (and its `invitation_notes`
>   table) was cut — that back-and-forth belongs in Phase 6 chat. The reserved
>   `'clarifying'` status stays in the schema but is unused; the page is four tabs.
> - **Reciprocity ADDED.** `accept_invite` was extended in 0016 so accepting a
>   `kind='friend'` request also creates the reciprocal linked member in the
>   accepter's roster — the friendship shows on both sides, not just the inviter's.

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

- [x] `/requests` shows the four sections (Received/Sent/Accepted/Rejected),
      filtered by direction/status via the pure `filterByTab` helper.
- [x] Accept / Reject work with correct RLS (`accept_invite` / `reject_invite`).
      *("Ask a question" removed with Clarifications.)*
- [x] Clarifications **dropped by decision** — deferred to Phase 6 chat.
- [x] Requests nav item shows an actionable-received badge (header + bottom bar).
- [x] Tab component lifted to `src/components/ui/tabs.tsx` (the old `group-tabs`
      was already removed in Phase 2, so this was rebuilt clean rather than lifted).

**Still to verify (needs 0016 applied + two accounts):** received rows appear for
the recipient; accept creates the reciprocal friend on both rosters; reject flips to
'rejected'; badge reflects only actionable-received. See the session memory note
[[migration-0016-friend-requests-pending]].
