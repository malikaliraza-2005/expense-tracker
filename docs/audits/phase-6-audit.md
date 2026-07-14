# Phase 6 Audit — Profile, Search & Responsive Polish

**Date:** 2026-07-14
**Reviewer:** Claude (self-audit of the Phase 6 implementation)
**Scope:** All Phase 6 deliverables — avatar storage, profile management, search, responsive navigation chrome, and dark mode.

---

## 1. Verification method

| Check | Result |
| --- | --- |
| `next lint` | ✅ No warnings or errors |
| `next build` (compile + typecheck) | ✅ 18 routes compiled, `/profile` and `/search` included |
| Runtime flows (upload, search, RLS) | ⚠️ **Not exercised** — requires a live Supabase project with migration `0006` applied |

> The build and lint are authoritative for type-safety and static correctness. Anything that touches Supabase Auth, Storage, or RLS at runtime is **built but unverified** and must be smoke-tested against a real project before this phase is considered accepted.

---

## 2. Deliverables coverage

| Spec item (phase-6 §2, §6) | Status | Location |
| --- | --- | --- |
| Avatar Storage bucket + owner-scoped RLS | ✅ Built | `supabase/migrations/0006_storage_policies.sql` |
| `updateProfile`, `uploadAvatar` actions | ✅ Built | `src/actions/profile.ts` |
| Profile schema validation | ✅ Built | `src/schemas/profile.schema.ts` |
| `searchFriends`, `searchGroups` | ✅ Built | `src/lib/queries/search.ts` |
| Profile page (view/edit, uploader, currency) | ✅ Built | `src/app/(app)/profile/page.tsx` |
| `ProfileForm`, `AvatarUploader` | ✅ Built | `src/components/profile/*` |
| `SearchBar`, `SearchResults` + `/search` page | ✅ Built | `src/components/search/*`, `src/app/(app)/search/page.tsx` |
| Avatar image rendering w/ initials fallback | ✅ Built + wired into friends/groups/expenses/nav | `src/components/ui/avatar.tsx` |
| Responsive UI (sidebar/top-bar/drawer) | ✅ Built | `src/components/layout/*`, `src/app/(app)/layout.tsx` |
| Dark mode (optional) | ✅ Built | `theme-toggle.tsx` + no-FOUC script in root layout |
| Expense history filters (optional) | ❌ Not built | Date-sort only (pre-existing); category/member/amount deferred |

---

## 3. Testing-checklist status (phase-6 §8)

Legend: ✅ built & static-checked · ⚠️ built, runtime-unverified · ❌ gap

**Functional**
- ⚠️ Profile name edit persists — `updateProfile` writes + revalidates; not runtime-tested.
- ⚠️ Avatar upload/replace works and displays — `upsert` + cache-bust; see Finding F-2.
- ⚠️ Search returns correct friends/groups — filters RLS-scoped reads; not runtime-tested.

**Security**
- ⚠️ A user cannot overwrite another user's avatar — enforced by `avatars_*_own` policies (`foldername[1] = auth.uid()`); not runtime-tested.
- ⚠️ Search results are RLS-scoped — built on `getFriends`/`getGroups`, which RLS scopes; structurally sound.
- ⚠️ See Finding F-1: avatar **reads** are public, broader than table RLS.

**Edge cases**
- ⚠️ Large/invalid image handled — server + client validate type/size; see Finding F-2 (boundary at exactly 2 MB).
- ✅ Empty query / no-results states — handled in `SearchResults`.
- ⚠️ Narrow-width layout — CSS-only breakpoints, no horizontal overflow expected; visually unverified.

---

## 4. Findings

### F-1 · Avatar bucket is public-read — broader than the spec's "mirror table RLS" (Medium, security/design)
`0006_storage_policies.sql` creates the `avatars` bucket with `public = true`, so **anyone** with the URL (`<supabase>/storage/v1/object/public/avatars/<uid>/avatar.ext`) can fetch any user's avatar without authentication. The object key embeds the user id, making URLs guessable.

- **Spec deviation:** phase-6 §2/§3 call for "access policies mirroring table RLS" and reads "limited to what the user may see." Table RLS on `profiles` is friends/group-members scoped, not public.
- **Trade-off:** Public avatars are common practice and avoid signed-URL churn; the leaked data (a display photo) is low-sensitivity. This was a deliberate simplification, but it is a deviation and should be an explicit product decision.
- **If stricter scoping is required:** make the bucket private and serve avatars via `createSignedUrl` in the data layer, or gate reads with a SELECT policy joining friendships/group_members.

### F-2 · Avatar size limit equals the Server Action body limit — near-limit uploads bypass the friendly error (Low-Medium, correctness/UX)
`AVATAR_MAX_BYTES = 2 MB` (`profile.schema.ts`) is **equal** to `serverActions.bodySizeLimit: '2mb'` (`next.config.mjs`). A file at or just under 2 MB, plus multipart boundary overhead, can exceed the body limit — Next rejects the request before `uploadAvatar` runs, so the user sees a framework error instead of the intended "Image must be 2 MB or smaller" toast.

- **Fix (pick one):** raise `bodySizeLimit` to `'3mb'`, or lower `AVATAR_MAX_BYTES` (and the bucket `file_size_limit`) to e.g. `1.5 MB`, so validation always wins.

### F-3 · `useMediaQuery` hook is dead code (Low, cleanliness)
`src/hooks/use-media-query.ts` was created (spec §6 lists it) but the responsive chrome uses CSS `md:` breakpoints instead — nothing imports it. Either delete it or use it (e.g. to avoid mounting the mobile drawer's DOM on desktop). CSS-only is the better default (no hydration flash), so **deleting is recommended**.

### F-4 · Mobile drawer lacks focus trapping (Low, accessibility)
`mobile-nav.tsx` implements `role="dialog" aria-modal="true"`, Escape-to-close, backdrop click, and scroll-lock — but does not trap focus or move focus into the panel on open. Keyboard/screen-reader users can tab out to the (visually hidden) page behind it. Acceptable for MVP; note for a11y follow-up. (Using the existing Radix `Dialog` primitive would give trapping for free.)

### F-5 · Search recomputes full balance engine per keystroke (Low, efficiency)
`searchFriends`/`searchGroups` call `getFriends()`/`getGroups()`, which run the balance engine (`getGroups` is N+1: one `getGroupBalances` per group). Each debounced keystroke re-runs both. React `cache` dedupes only within a single request, not across them. Fine at MVP data volumes; revisit if a user has many groups. A name-only search could skip balance computation entirely.

### F-6 · `/settings` route is defined but orphaned (Informational)
`ROUTES.settings` exists and `src/app/(app)/settings/page.tsx` is still a Phase-0 placeholder; nothing in the new nav links to it. Not a Phase 6 deliverable — flagging so it isn't mistaken for a regression. Remove the route/page or defer intentionally.

---

## 5. Things that are solid

- **Input is validated twice** (client for UX, server for trust) for both profile update and avatar upload — matches the project's established schema pattern.
- **Storage write policies are correctly owner-scoped** via `(storage.foldername(name))[1] = auth.uid()::text` for insert/update/delete, with `WITH CHECK` on both insert and update (correct for `upsert`).
- **Search cannot leak** — it filters already-RLS-scoped results rather than issuing new unscoped queries, so it structurally inherits visibility rules.
- **Avatar cache-busting** (`?v=<timestamp>`) correctly forces re-fetch after an in-place replace at a stable object key.
- **No-FOUC theme script** applies the stored/`prefers-color-scheme` theme before first paint; toggle persists an explicit choice.
- **`router.refresh()` + `revalidatePath('/', 'layout')`** correctly propagate a new name/avatar into the app shell.

---

## 6. Recommended actions before sign-off

1. **Apply migration `0006`** to the Supabase project and smoke-test: upload an avatar, replace it, confirm it renders in sidebar + friends + expense detail.
2. **Resolve F-2** (size-limit vs body-limit) — a one-line config change.
3. **Decide F-1** explicitly: are public avatars acceptable? Document the answer.
4. **Delete `useMediaQuery`** (F-3) unless a use is planned.
5. **Two-account RLS check:** confirm user A cannot write to `avatars/<B-uid>/…` (should 403).
6. Optional: pick up expense filters (category/member/amount) if time remains — the toolbar in `expense-filters.tsx` is already laid out for it.
