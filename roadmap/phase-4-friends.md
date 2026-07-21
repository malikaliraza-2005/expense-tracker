# Phase 4 — Friends page

**Goal:** Add friends by email or shareable link. If the recipient already has a
profile, send an in-app friend request; if not, send an email invitation with an
account-creation link.

**Status:** Code complete — pending migration **0016** (apply by hand) + E2E on a
second seeded account. Built on Phase 1 (invite plumbing). tsc + lint + vitest
(40/40) + `next build` (16 routes; `/friends` live, 124 kB First Load) all green.

---

## Context

Per the locked decision, **a friend is a `members` row with `linked_user_id` set** —
no separate social graph. The Friends page lists the owner's members who are (or are
being) linked to real accounts, each with a running balance and settle-up (reusing
Phase 3 controls). Adding a friend reuses the invitation/claim rails from 0014 and
`inviteMemberByEmail` (`src/actions/invite.ts`).

## Technical approach

1. **Friends list.** New route `src/app/(app)/friends/` (Server Component) listing
   members with `email` and/or `linked_user_id`, each row showing the running balance
   (`src/lib/balances.ts`) and a Settle-up action (Phase 3 controls). New query module
   `src/lib/queries/friends.ts`.
2. **Add by email** (new/extended action). On submit, resolve whether a profile
   exists for the email via a new SECURITY DEFINER RPC `find_profile_by_email`
   (safely re-introducing the dropped 0007 helper — returns a boolean/uuid, never
   leaks profile details):
   - **Profile exists →** create an in-app **friend request**: an `invitations` row
     with `kind = 'friend'` and no `target_expense_id`. The recipient sees it on their
     Requests page (Phase 5).
   - **No profile →** `inviteMemberByEmail(..., { send: true })` sends the
     account-creation email (Phase 1 path).
3. **Add by link.** `inviteMemberByEmail(..., { send: false })` → copyable
   `/invite/<token>`.
4. **Reuse:** `src/utils/people.ts` (email→name matching, `matchPeople`/`findExisting`),
   `PersonSearch`, `InviteByEmailDialog`.

## Files to change

- **Create:** `src/app/(app)/friends/` (page + loading/empty states),
  `src/components/friends/**`, `src/lib/queries/friends.ts`,
  `supabase/migrations/0016_friend_requests.sql`.
- **Edit:** `src/actions/invite.ts` (add friend-request creation + profile lookup
  wiring), `src/schemas/invite.schema.ts` (accept `kind`),
  `src/components/layout/nav-config.ts` (add Friends nav item),
  `src/types/database.types.ts` + `src/types/db.ts` (hand-sync new columns/table/RPCs).
- **Reuse:** `inviteMemberByEmail`, `sendInviteEmail`, `PersonSearch`, `people.ts`.

## Schema / migration — `0016_friend_requests.sql` (apply by hand)

```sql
-- 1. Distinguish member invites from friend requests
alter table invitations
  add column kind text not null default 'member'
  check (kind in ('member','friend'));

-- 2. Allow rejection (Phase 5 also adds 'clarifying')
alter table invitations drop constraint invitations_status_check;
alter table invitations add constraint invitations_status_check
  check (status in ('pending','accepted','revoked','expired','rejected','clarifying'));

-- 3. Recipient-visible SELECT policy (today invitations are inviter-only)
create policy invitations_select_recipient on invitations
  for select to authenticated
  using (
    accepted_user_id = auth.uid()
    or lower(email) = lower((auth.jwt() ->> 'email'))
  );

-- 4. Safe email→profile lookup (no detail leak)
create or replace function find_profile_by_email(p_email text)
returns uuid language sql security definer set search_path = public stable as $$
  select id from profiles
  where lower(id::text) <> ''  -- placeholder; match on the profile's auth email
    and lower((select email from auth.users u where u.id = profiles.id)) = lower(p_email)
  limit 1;
$$;
grant execute on function find_profile_by_email(text) to authenticated;

-- 5. Reject an invite/request
create or replace function reject_invite(p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update invitations set status = 'rejected'
  where token = p_token and status in ('pending','clarifying')
    and (accepted_user_id = auth.uid()
         or lower(email) = lower((auth.jwt() ->> 'email')));
  return found;
end $$;
grant execute on function reject_invite(text) to authenticated;
```

*(`invitation_notes` for Clarifications is defined in Phase 5, folded into the same
0016 migration.)*

## Edge cases

- Inviting **yourself** → reject.
- Inviting an **existing friend** → dedupe via the pending partial-unique index.
- Recipient owns **multiple** members for the same person → link the intended one.
- Request **accepted then unfriended** → status/relationship transition (define
  "unfriend" = clear `linked_user_id` / mark revoked).
- Email **casing** → normalize.
- **Profile-existence must not leak** beyond a boolean/uuid to the caller.

## Testing

- **Unit:** friend vs member `kind` routing; status transition helpers.
- **RPC/RLS (manual, second seeded account):** `find_profile_by_email` returns only a
  boolean/uuid; recipient can see their received request via the new SELECT policy but
  not others'; `reject_invite` flips status only for a party to the invitation.
- **Manual:** add friend by email (profile exists → request; no profile → email);
  add by link; verify the friend appears with a running balance.

## Done when

- [x] `/friends` lists linked/invited members with balances + settle-up.
- [x] Add-by-email routes to in-app request or email invite based on profile
      existence.
- [x] Add-by-link produces a copyable `/invite/<token>`.
- [~] Migration 0016 written; `database.types.ts` hand-synced. **Apply by hand.**
- [~] RLS verified: recipient sees their request; no profile leak. **Pending a
      second seeded account + 0016 applied** (same gating as Phases 1/3).

## Implementation notes

- **Friend = member with email and/or `linked_user_id`.** `getFriends`
  (`src/lib/queries/friends.ts`) filters the owner's members to those, joins the
  balance-engine net, and derives a `FriendStatus` (`linked` / `invited` /
  `not_invited`) via the pure `src/lib/friends.ts`. Plain name-only members with no
  email stay on Expense Detail, not here.
- **Add flow** is a single `addFriend` action (`src/actions/invite.ts`) that
  delegates to the extended `inviteMemberByEmail`: `mode:'link'` → share link;
  `mode:'auto'` → `find_profile_by_email` decides request (`kind='friend'`,
  `send:false`) vs email invite (`kind='member'`, `send:true`). Self-add is
  rejected. **Graceful degrade:** if `find_profile_by_email` isn't live yet (0016
  unapplied) or errors, it falls back to the email-invite path — the page and add
  dialog work today; the request-routing lights up once 0016 lands.
- **Pending-invite uniqueness:** the 0014 partial index allows one live invite per
  member+email regardless of kind, so a reused pending invite is *promoted* to
  `kind='friend'` rather than duplicated.
- **`find_profile_by_email` returns the account id** (or null), not a boolean — the
  self-check compares it to `auth.uid()` (via `decideAddRoute`). It exposes only
  that single id, never profile/auth detail (SECURITY DEFINER over `auth.users`).
- **Deviations from the plan:** (1) `invite.schema.ts` was **not** given a `kind`
  field — the client never sends `kind`; it's decided server-side, so validating it
  would be dead surface. (2) `invitation_notes` (Clarifications) is **not** in 0016
  yet — it's Phase 5's; 0016 has a marked append point for it. (3) Nav: Friends was
  added to `PRIMARY_NAV` (Home · Expenses · Friends around the center Add).
- **UI:** `/friends` page + `loading.tsx`; `components/friends/{add-friend-dialog,
  friend-row-actions}.tsx`. Settle-up reuses `SettleUpDialog`; per-row invite reuses
  `InviteByEmailDialog`. `next.config` no longer redirects `/friends` → `/expenses`.
