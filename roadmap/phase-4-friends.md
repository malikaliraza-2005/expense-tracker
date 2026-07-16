# Phase 4 — Friends page

**Goal:** Add friends by email or shareable link. If the recipient already has a
profile, send an in-app friend request; if not, send an email invitation with an
account-creation link.

**Status:** Not started. Depends on Phase 1 (invite plumbing) and migration **0016**.

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

- [ ] `/friends` lists linked/invited members with balances + settle-up.
- [ ] Add-by-email routes to in-app request or email invite based on profile
      existence.
- [ ] Add-by-link produces a copyable `/invite/<token>`.
- [ ] Migration 0016 applied; `database.types.ts` hand-synced.
- [ ] RLS verified: recipient sees their request; no profile leak.
