# Phase 8 — Responsive UI/UX & edge-case hardening

**Goal:** Fix responsiveness across mobile / tablet / desktop and handle app-wide edge
cases across every surface (including the new Friends, Requests, and Chat pages).

**Status:** Not started. Runs continuously alongside earlier phases; finalized last.

---

## Context

The app already did a11y tap-target work (commit `ff73ccf`) and uses a Tailwind
config (`tailwind.config.ts`). Removing People + Groups (Phase 2) drops two items from
the bottom nav, and Phases 4–6 add three new destinations — so nav balance and the new
pages need a responsive pass. The app is single-currency per account
(`currency-blind-balances-latent`) — do **not** build multi-currency.

## Technical approach

1. **Responsive audit** at three breakpoints — mobile (≤640), tablet (641–1024),
   desktop (≥1025) — for each surface:
   - **Nav bar** — rebalance the bottom bar (lost People/Groups, gained
     Friends/Requests/Chat); ensure the central "Add" action still reads well.
   - **New pages** — Friends, Requests (tabs + badges), Chat (list + thread, keyboard
     avoidance on mobile).
   - **Expense Detail** — the new per-member owe/paid/remaining rows + remove/settle
     controls must not overflow on narrow screens.
   - **Dialogs** — invite, settle-up, add-to-friends.
2. **Global edge-case hardening:**
   - Empty states for Friends / Requests / Chat.
   - Loading skeletons / suspense boundaries.
   - Error boundaries (memory notes a `/members` 404 error-boundary risk from
     unapplied migrations — keep boundaries around RPC-backed routes).
   - Offline / optimistic UI consistency (esp. chat + realtime).
   - Long names / emails truncation with tooltips.
3. **Continue** the sub-40px tap-target work from `ff73ccf` on all new controls.

## Files to change

- **Edit (styling/structure):** `src/components/layout/**` (nav),
  `src/components/friends/**`, `src/components/requests/**`,
  `src/components/chat/**`, `src/components/expenses/expense-detail.tsx`, shared
  `src/components/ui/**`.
- **Add where missing:** `loading.tsx` / `error.tsx` route files, empty-state
  components.
- **Reuse:** existing Tailwind tokens/config; existing skeleton/empty-state patterns.

## Schema / migration

None.

## Edge cases (app-wide checklist)

- Zero friends / zero requests / no messages → friendly empty states, not blank
  panels.
- Very long member names, emails, expense titles → truncate + title attribute.
- Rapid tab switches on Requests → no flicker / stale badge.
- Chat on mobile with the on-screen keyboard → input stays visible, thread scrolls.
- Slow network → skeletons, not layout shift.
- RPC failures (e.g. migration not applied) → error boundary, not a white screen.

## Testing

- **Manual device-emulation pass** per breakpoint (Chrome DevTools device toolbar) on
  every surface, portrait + landscape.
- **Tap targets:** re-verify ≥40px on all interactive controls (parity with
  `ff73ccf`).
- **Edge states:** force empty/loading/error states and confirm graceful rendering.
- **Regression:** run the vitest suite; `next build` clean.

## Done when

- [ ] All surfaces render cleanly at mobile / tablet / desktop with no horizontal
      overflow.
- [ ] Nav rebalanced for the new destination set.
- [ ] Empty / loading / error states present on Friends, Requests, Chat.
- [ ] Tap targets ≥40px on new controls.
- [ ] vitest + `next build` green.
