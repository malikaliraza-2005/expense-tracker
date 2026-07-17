# Collaboration, Fixes & Realtime — Roadmap

Execution-ready, per-phase plan to turn the app from a single-owner expense tracker
into a social expense splitter (friends, requests, real-time chat, live sync),
while fixing the invite/email/login bugs and removing redundant pages.

> **Canonical source:** `C:\Users\offic\.claude\plans\eventual-puzzling-hamster.md`.
> These `roadmap/` files are the checked-in, per-phase working copies.

## Phase index

| Phase | File | Goal | Status |
|-------|------|------|--------|
| 1 | [phase-1-invite-fixes.md](phase-1-invite-fixes.md) | Real email invites, invite landing, no post-login 404 | **Done — pending E2E verification** |
| 2 | [phase-2-remove-people-groups.md](phase-2-remove-people-groups.md) | Remove People + Groups pages safely | **Done — verified (build + redirects)** |
| 3 | [phase-3-expense-detail.md](phase-3-expense-detail.md) | Per-member owe/paid/remaining, remove buttons, settle-up, "add to friends?" | **Code complete — pending E2E verification** |
| 4 | [phase-4-friends.md](phase-4-friends.md) | Friends page: add by email/link, in-app request or email invite | **Code complete — pending 0016 + E2E** |
| 5 | [phase-5-requests.md](phase-5-requests.md) | Requests page: Sent/Received/Accepted/Rejected (Clarifications dropped) | **Code complete — pending 0016 + E2E** |
| 6 | [phase-6-chat.md](phase-6-chat.md) | ~~Friend DMs~~ → **per-expense chat** ([docs/update_chat_feature.md](../docs/update_chat_feature.md)) + Groups page restored | **Code complete — apply `0017_expense_chat.sql` (swap), then E2E** |
| 7 | [phase-7-realtime-sync.md](phase-7-realtime-sync.md) | App-wide live sync (expenses, balances, friends, requests) | Not started |
| 8 | [phase-8-responsive-edge.md](phase-8-responsive-edge.md) | Responsive audit + edge-case hardening | Not started |

## Context

The app pivoted (migration 0010) to a **single-owner, name-only `members`** model:
only the account holder logs in, and everyone they split with is a `members` row
they own. Migrations **0014** (invitations + `members.linked_user_id`) and **0015**
(cross-user read visibility) already lay the multi-account rails but — per project
memory — are **committed yet not applied** to the live DB (migrations run by hand in
the Supabase SQL editor).

This roadmap completes the pivot into a social app: real email invites, a proper
invite landing/login flow, a Friends page, a Requests page, real-time chat between
friends, app-wide realtime sync, removal of the redundant People and Groups pages,
and an enhanced Expense Detail (per-member owe/paid/remaining with remove buttons
and settle-up). Existing bugs (profile "Invite Friends" builds a dead
`/register?ref=` link; email not actually sent; post-login 404) are fixed first.

## Locked decisions

1. **Friend = linked member.** Keep the single `members` table. A "friend" is a
   member whose `linked_user_id` points to a real account. No separate friendships
   graph — extend the 0014 invitation/claim rails. Reciprocal linking makes a mutual
   friendship.
2. **Requests page sections:** Sent, Received, Accepted, Rejected. **Clarifications
   was dropped** (Phase 5 build decision): that back-and-forth belongs in Phase 6
   chat, so no `invitation_notes` table was added — the reserved `'clarifying'`
   status simply stays unused for now.
3. **Settle-up moves into Expense Detail** (alongside new per-member owe/paid/
   remaining rows). The People page — its only current home — is removed.
4. **Chat is gated on accepted friendship only** (both sides linked accounts with an
   accepted relationship).

## Prerequisites (before any collaboration phase goes live)

- **Apply pending migrations 0014 + 0015** in the Supabase SQL editor. Nothing
  invite/friend-related works until these are live. Verify:
  ```sql
  select proname from pg_proc
  where proname in ('accept_invite','invite_details','can_see_expense','can_see_member');
  ```
  and confirm `members.linked_user_id` and the `invitations` table exist.
- **Email delivery is config, not just code.** `RESEND_API_KEY` is empty in
  `.env.example`/`.env.local`. "Direct email" requires `RESEND_API_KEY` + a
  **verified** `RESEND_FROM` domain in Resend, plus a correct `NEXT_PUBLIC_SITE_URL`.
  Until then, `sendInviteEmail` (`src/lib/email/resend.ts`) logs the link and returns
  `{ sent:false, reason:'no_api_key' }` — the UI must degrade to "copy link."

## Suggested order & dependencies

1. **Prereqs:** apply 0014 + 0015; configure Resend + `NEXT_PUBLIC_SITE_URL`.
2. **Phase 1** (fixes) — unblocks all invite/friend flows.
3. **Phase 3** (Expense Detail incl. settle-up move) — **before/with Phase 2** so
   settlement recording is never absent.
4. **Phase 2** (remove People/Groups).
5. **Phase 4** (Friends) → **Phase 5** (Requests) — Requests depends on Friends'
   invitation `kind` / `rejected` / recipient-RLS schema (migration 0016).
6. **Phase 6** (Chat) — depends on accepted-friendship state from Phases 4/5.
7. **Phase 7** (realtime sync) — after Phase 6 establishes the realtime pattern.
8. **Phase 8** (responsive/edge) — continuous, finalized last.

**Each phase ends with a STOP for sign-off before the next** (per
`phased-work-one-at-a-time`).

## New migrations introduced

| Migration | Phase | Adds |
|-----------|-------|------|
| `0016_friend_requests.sql` | 4 + 5 | `invitations.kind`, `'rejected'`/`'clarifying'` statuses, recipient-visible RLS, `find_profile_by_email`, `reject_invite`, and (Phase 5) `accept_invite` extended for reciprocal friend-linking. `invitation_notes` was **not** added — Clarifications dropped. |
| `0017_chat.sql` | 6 | `conversations`/`messages`, `are_friends()` helper, friendship-gated RLS |

## Data synchronization design

- **Source of truth:** Postgres + RLS. Balances derived on read
  (`src/lib/balances.ts`), never stored.
- **Writes:** `'use server'` actions → RPC/insert → `revalidatePath` (existing
  pattern, keep).
- **Live updates (new):** Supabase `postgres_changes` subscriptions in Client
  Components → `router.refresh()` (Phases 6–7). Chat additionally uses realtime as
  the primary transport.
- **Cross-user visibility:** governed by 0015 `can_see_expense`/`can_see_member` plus
  the new recipient/friend policies — realtime inherits these.

## Key risks / call-outs

- **Migrations are manual** — every new migration (0016, 0017) must be applied by
  hand before its code works; a committed migration is not live.
- **Email is infra-gated** — direct email needs a real Resend key + verified domain;
  without it the UX stays copy-link.
- **Recipient-visible invitations** require a new RLS policy — today `invitations`
  is inviter-only, so the Requests "Received" tab returns nothing until 0016 lands.
- **Realtime must be enabled per-table** in the Supabase dashboard, separate from
  code.
- Keep the **single-owner, name-only members** model and **single-currency**
  assumption; the friend layer sits on top via `linked_user_id`, not a rewrite.

## Testing strategy (cross-phase)

- **Unit (vitest):** extend `tests/unit/splits.test.ts` and
  `tests/unit/balances.test.ts`; add pure-helper tests for friend-request status
  transitions and `are_friends` logic.
- **RPC/RLS (manual, Supabase SQL editor + a seeded second account):** recipient can
  see received invitations but not others'; `reject_invite`; chat RLS blocks
  non-friends; realtime respects RLS.
- **E2E:** use the session-minting recipe in the `verify-protected-routes-authed`
  memory to drive auth-gated routes; the `/verify` and `/run` skills to drive the
  real app per phase.
- **Realtime:** two browser sessions (two accounts) — a write in one appears live in
  the other.
