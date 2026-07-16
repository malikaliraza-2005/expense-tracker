# Phase 7 — App-wide realtime sync

**Goal:** Expenses, balances, friend lists, and requests update live across the app
without a manual refresh.

**Status:** Not started. Best done **after Phase 6** establishes the realtime pattern
and the auth-on-socket check.

---

## Context

Today all sync is server-actions + `revalidatePath` (no SWR/react-query, no
`revalidateTag`). Reads are Server Components calling `src/lib/queries/*`; writes are
`'use server'` actions. This phase adds a thin realtime layer **on top** of that model
rather than replacing it — the server-rendered DTO pipeline stays authoritative and
simply becomes reactive.

## Technical approach

1. **`useRealtimeRefresh(table, filter)` hook.** A small Client Component hook that
   subscribes via `src/lib/supabase/client.ts` to `postgres_changes` on a table,
   filtered by owner/visibility, and calls `router.refresh()` on an event to re-pull
   the Server-Component data. Debounce to coalesce bursts.
2. **Mount points.** Add the hook (or a `<RealtimeRefresher/>` wrapper) to:
   - **Dashboard** — `expenses`, `expense_splits`, `settlements`
   - **Expenses list / detail** — `expenses`, `expense_splits`, `settlements`
   - **Friends** — `members`, `invitations`
   - **Requests** — `invitations`, `invitation_notes`
3. **RLS inheritance.** Realtime respects RLS; the 0015 shared-read policies already
   let a linked account see shared expenses, so cross-user updates propagate. Verify
   subscriptions never deliver rows beyond RLS.

## Files to change

- **Create:** `src/hooks/use-realtime-refresh.ts`,
  `src/components/common/realtime-refresher.tsx` (thin client wrapper).
- **Edit:** mount the refresher in `src/app/(app)/dashboard/page.tsx`,
  `src/app/(app)/expenses/**`, `src/app/(app)/friends/**`,
  `src/app/(app)/requests/**` (via a client child, since pages are Server
  Components).
- **Reuse:** `src/lib/supabase/client.ts` channel API; the Phase 6 auth-on-socket
  verification.

## Schema / migration

None. **But** each synced table must have **Realtime enabled** in the Supabase
dashboard (Database → Replication): `expenses`, `expense_splits`, `settlements`,
`members`, `invitations`, `invitation_notes`. This is an infra toggle, separate from
code.

## Edge cases

- **Subscription cleanup** on unmount / route change (avoid leaks + duplicate
  channels).
- **Reconnection** after laptop sleep / network drop → re-subscribe and refresh once.
- **Refresh storms** — debounce; coalesce multiple events into one `router.refresh()`.
- **RLS leakage** — confirm a user never receives change events for rows they can't
  read.
- **Realtime not enabled on a table** → subscription silently receives nothing; log a
  dev warning where feasible.

## Testing

- **Manual (two accounts, two browsers):** a write in one session appears live in the
  other for expenses, balances, friends, and requests.
- **RLS:** with two unrelated accounts, confirm no cross-account events arrive.
- **Resilience:** sleep/resume the tab → subscriptions recover and data re-syncs.

## Done when

- [ ] `useRealtimeRefresh` subscribes + debounced-refreshes on real changes.
- [ ] Dashboard, Expenses, Friends, Requests update live.
- [ ] Subscriptions clean up on unmount and recover after reconnect.
- [ ] Realtime enabled on all synced tables; no RLS leakage observed.
