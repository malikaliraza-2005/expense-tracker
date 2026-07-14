# Phase 3 — Friends & Groups

## 1. Phase Overview

**Objective**
Build the social graph that expenses attach to: friends (registered users only) and groups with members.

**Scope**
Friend add/search/remove + per-friend balance; group create/edit/delete, membership management, group summary & balance.

**Expected outcome**
Users can assemble the people and groups needed to record shared expenses. The app is now "populated".

---

## 2. Features / Modules

**Included:** Add Friend, Search Friends, Remove Friend, Friends List, Balance-with-friend; Create/Edit/Delete Group, Add/Remove Members, View Members/Summary/Balance.

**User flows**
- **Add friend:** enter email → resolve to existing profile → create link (or "no account found").
- **Create group:** name + type → optionally add members → group appears in list.
- **Manage members:** owner adds/removes members from a group.
- **View group:** members, summary, and who-owes-whom balance.

**Business rules**
- Friends must be registered users; no self-friend; no duplicate links.
- Only members can view a group; only the owner can edit/delete/manage membership.
- Deleting a group is blocked while it has expenses.

---

## 3. Backend Implementation Plan

**Backend tasks**
- Friend actions: resolve email → profile; create/remove `friendships`.
- Group actions: create (with type), edit, delete (guarded), membership add/remove.
- Reuse `lib/balances` for per-friend and per-group reads.

**Database operations**
- Insert/delete `friendships`; insert/update/delete `groups`; insert/delete `group_members`.
- Reads join `group_members` for membership scoping.

**Server actions / API requirements**
- `addFriend`, `removeFriend`, `createGroup`, `updateGroup`, `deleteGroup`, `addGroupMember`, `removeGroupMember`.
- Reads: `getFriends`, `getFriendBalance`, `getGroups`, `getGroup`, `getGroupMembers`, `getGroupLedger`.

**Security considerations**
- RLS ensures non-members cannot see/mutate a group.
- Actions re-check ownership for edit/delete/membership changes.
- Prevent duplicate friendships via unique constraint + pre-check.

---

## 4. Frontend Implementation Plan

**Pages / components**
- Friends page: list with per-friend balance, search input, add-by-email dialog, remove control.
- Groups list page; create/edit group dialog with type selector.
- Group detail page: members list, summary, balance ledger, member-management UI.

**UI states**
- Empty states (no friends / no groups), loading skeletons, error toasts, "no account found" message.

**User interactions**
- Add/remove friend; create/edit/delete group; add/remove members; open group detail.

---

## 5. Database Changes

**Tables affected:** `friendships`, `groups`, `group_members` (already created in Phase 2 — used here).

**Schema changes:** none new (add missing indexes/policies only if a gap surfaces).

**RLS policies:** rely on Phase 2 policies; verify membership scoping in practice.

**Indexes / triggers:** none new.

---

## 6. Files / Modules Expected To Be Created

- `src/app/(app)/friends/` (page + components).
- `src/app/(app)/groups/` (list, `[groupId]` detail).
- `src/lib/actions/friends.ts`, `src/lib/actions/groups.ts`.
- `src/lib/queries/friends.ts`, `src/lib/queries/groups.ts`.
- Feature components: `FriendList`, `AddFriendDialog`, `GroupCard`, `GroupForm`, `MemberManager`.

---

## 7. Dependencies

**Previous phases:** Phase 2 (tables, RLS, balance module); Phase 1 (auth).
**Depends on:** `lib/balances`, `lib/queries`.

---

## 8. Testing Checklist

**Functional**
- [ ] Add friend by email (existing account) creates the link; unknown email shows "no account found".
- [ ] Remove friend removes the link.
- [ ] Search filters the friends list correctly.
- [ ] Create/edit/delete group works; type selector persists.
- [ ] Add/remove members reflects immediately in the group.

**Security**
- [ ] Non-member cannot view or mutate a group (RLS).
- [ ] Non-owner cannot edit/delete/manage membership.

**Edge cases**
- [ ] Attempt to friend oneself is rejected.
- [ ] Duplicate friend link prevented.
- [ ] Delete group with expenses is blocked with a clear message.

**Acceptance criteria**
- [ ] Friends and groups can be fully managed; balances per friend/group read correctly; RLS scoping holds.

---

## 9. Demo Checklist

- [ ] Add a friend and see them in the list with a zero balance.
- [ ] Create a group of a chosen type and add members.
- [ ] Open the group detail: members + summary + (empty) ledger.
- [ ] Attempt a blocked action (delete group with expenses) and see the guard.
