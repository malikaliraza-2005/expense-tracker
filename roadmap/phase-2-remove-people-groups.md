# Phase 2 — Remove People & Groups pages

**Goal:** Delete the two redundant destinations (People, Groups) without breaking the
expense flows that reuse their components.

**Status:** Done — verified. Phase 3's settle-up relocation shipped first (settle-up
now lives on Expense Detail), so settlement recording was never absent. Removal done
in commit `db5724d` (files) on top of checkpoint `d16bbe8` (nav/redirects/revalidate/
scope-picker edits). `tsc`, `next lint`, `next build`, and `vitest` (34/34) all green;
`/members`, `/groups`, and `/groups/:path*` confirmed returning 307 → `/expenses`.

---

## Context

- **People** page (`/members`) is redundant: Expense Detail already shows who owes
  whom and payment status.
- **Groups** page (`/groups`) is redundant: the Expenses page serves the same
  purpose, and the app is name-based/equal-split (`members-name-based-pivot`).
- Several members/groups components are **reused by the expense flow** and must
  survive. The blast radius below was verified by exploration.

## Technical approach

1. Ship Phase 3's settle-up relocation first (dependency).
2. Delete the groups-only and People-only files (see below).
3. Fix dangling references (nav, dashboard getting-started, revalidate paths, route
   constants, redirects).
4. Hide the group **scope picker** in the expense form (keep expenses group-optional
   at the schema level).

## Files to change

### Safe to delete (no external importers — confirmed)
- `src/app/(app)/groups/**` (6 files)
- `src/components/groups/**` (5 files)
- `src/actions/groups.ts`
- `src/lib/queries/groups.ts`
- `src/app/(app)/members/**` (People page)
- `src/components/members/people-list.tsx`
- `src/components/members/member-row-actions.tsx`
- `src/components/members/settlement-controls.tsx` *(its settle-up UI moves to
  Expense Detail in Phase 3 — port before deleting)*

### MUST NOT delete (reused by expense flows)
- `src/components/members/person-search.tsx` — used by `expense-form.tsx`
- `src/components/members/invite-dialog.tsx` (`InviteByEmailDialog`) — used by
  `expense-detail.tsx`
- `src/actions/members.ts` `addMember` — used transitively by the expense form
- `src/lib/queries/members.ts` — used by dashboard + expenses
- `src/lib/queries/settlements.ts` (`listSettlements`) — used by dashboard
- `src/utils/people.ts`, `src/actions/settlements.ts`, `src/actions/share.ts`

### Edit (dangling references)
- `src/components/layout/nav-config.ts` — remove the `People` and `Groups` nav items
  (lines ~28–29). Friends/Requests/Chat replace them in later phases.
- `src/components/dashboard/getting-started.tsx` — the step linking `ROUTES.members`
  → retarget to Expenses/Friends; fix hint copy ("Settle up on the People page").
- `revalidatePath(ROUTES.members)` / group paths in `src/actions/settlements.ts`,
  `src/actions/share.ts`, `src/actions/invite.ts` — repoint to surviving routes.
- `src/constants/routes.ts` — keep or repurpose `members`/`groups` constants (still
  referenced by revalidations); add redirects `/members`, `/groups` → `/expenses` in
  `next.config.mjs` (mirrors the existing retired-routes pattern,
  `retired-routes-redirects`).
- `src/lib/queries/expenses.ts` (`getExpenseFormData`) + `expense-form.tsx` — hide/
  remove the group **scope picker**; keep everyone/equal-split. Leave the `groups`/
  `group_members` schema intact (expenses stay group-optional).

## Schema / migration

None. No DB changes — this is a UI/route removal. `groups`/`group_members` tables and
the `group_id` columns remain for historical data and optional future use.

## Edge cases

- Deep links / bookmarks to `/members`, `/groups` → handled by `next.config.mjs`
  redirects.
- Dashboard "getting started" links must not dead-end.
- Settlement history rows that referenced a `group_id` still render (group context
  simply not shown).
- Any error boundary that assumed a `/members` route.

## Testing

- **Build/lint:** `npx tsc --noEmit`, `npx eslint .`, `next build` — no dangling
  imports or broken routes.
- **Manual:** visit `/members` and `/groups` → redirect to `/expenses`; nav no longer
  shows People/Groups; dashboard getting-started links resolve; create/settle an
  expense still works end-to-end.

## Done when

- [x] People + Groups pages and groups-only components/actions/queries deleted.
- [x] All shared expense-flow components still present and working.
- [x] Nav, dashboard, revalidations, and route redirects updated; no broken links.
- [x] Expense form no longer shows the group scope picker.
- [x] Build + lint clean; `/members` and `/groups` redirect to `/expenses`.
