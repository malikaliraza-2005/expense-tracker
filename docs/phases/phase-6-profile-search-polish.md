# Phase 6 — Profile, Search & Responsive Polish

> Post-MVP enhancement. Elevates a working core to a polished, presentable product.

## 1. Phase Overview

**Objective**
Raise the MVP to a polished, presentable product across all screen sizes, with profile management and search.

**Scope**
- **Required:** responsive UI (desktop/tablet/mobile); user profile (view, edit name, avatar upload); search (friends, groups).
- **Optional (time-gated):** expense history filters (sort + filter by category/member/date/amount); dark mode.

**Expected outcome**
A refined, fully responsive product with profile management and search; optional filters/dark mode if time remains.

---

## 2. Features / Modules

**Included (required):** Responsive UI, View/Edit Profile, Avatar upload, Preferred currency display, Search Friends, Search Groups.
**Included (optional):** Expense history filters, Dark mode.

**User flows**
- **Edit profile:** update name / upload avatar / view preferred currency → persists.
- **Search:** type a query → matching friends/groups appear (RLS-scoped).
- **(Optional) Filter history:** sort newest/oldest; filter by category/member/date/amount.

**Business rules**
- Avatar stored in Supabase Storage with access policies mirroring table RLS.
- Search results limited to what the user may see.
- Single currency drives display everywhere.

---

## 3. Backend Implementation Plan

**Backend tasks**
- `updateProfile` and `uploadAvatar` (Storage) actions.
- Search read helpers over friends/groups (and expenses if time allows).
- Wire filter parameters into `listExpenses` (optional).

**Database operations**
- Update `profiles`; write avatar object to Storage; filtered reads.

**Server actions / API requirements**
- `updateProfile`, `uploadAvatar`.
- Reads: `searchFriends`, `searchGroups` (+ filtered `listExpenses`).

**Security considerations**
- Storage RLS: a user can write/replace only their own avatar object.
- Search reads remain RLS-scoped.

---

## 4. Frontend Implementation Plan

**Pages / components**
- Profile page (view/edit, avatar uploader, currency display).
- Search UI (friends/groups) — could be a global search or per-section.
- Responsive pass across all pages; skeletons, empty/error states.
- (Optional) Filter controls on expense history; dark-mode toggle + theming.

**UI states**
- Profile: idle, saving, upload progress, error, success.
- Search: empty query, no results, results.

**User interactions**
- Edit profile; upload avatar; search; (optional) filter/sort; toggle theme.

---

## 5. Database Changes

**Tables affected:** `profiles` (update); Storage bucket for avatars (new).

**Schema changes:** none to tables.

**RLS policies:** Storage policies for the avatar bucket (owner-scoped).

**Indexes / triggers:** none new.

---

## 6. Files / Modules Expected To Be Created

- `src/app/(app)/profile/page.tsx`.
- `src/lib/actions/profile.ts`.
- `src/lib/queries/search.ts`.
- Components: `ProfileForm`, `AvatarUploader`, `SearchBar`, `SearchResults`, (optional) `ExpenseFilters`, `ThemeToggle`.
- Storage bucket + policies (config/migration).

---

## 7. Dependencies

**Previous phases:** Phases 1–5 (profile, entities, lists to search/polish).
**Depends on:** Supabase Storage; existing pages to make responsive.

---

## 8. Testing Checklist

**Functional**
- [ ] Profile name edit persists.
- [ ] Avatar upload/replace works and displays.
- [ ] Search returns correct friends/groups.
- [ ] (Optional) Filters/sort return correct subsets.

**Security**
- [ ] A user cannot overwrite another user's avatar (Storage RLS).
- [ ] Search results are RLS-scoped.

**Edge cases**
- [ ] Large/invalid image handled gracefully.
- [ ] Empty search query and no-results states.
- [ ] Layout at narrow widths — no horizontal body overflow.

**Acceptance criteria**
- [ ] Profile + search work; app is fully responsive; optional items work if shipped.

---

## 9. Demo Checklist

- [ ] Edit profile name and upload an avatar.
- [ ] Search for a friend and a group.
- [ ] Resize to mobile/tablet/desktop — layout holds.
- [ ] (If shipped) filter expense history; toggle dark mode.
