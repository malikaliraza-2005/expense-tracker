/**
 * Requests logic — pure, dependency-free rules shared by the Requests page (tab
 * filtering, badge count) and its tests. Kept out of the query/action layer so it
 * runs identically on the server and in unit tests, with no Supabase dependency.
 *
 * The Requests page is five-into-four: the roadmap's "Clarifications" section was
 * dropped (that conversation belongs in Phase 6 chat), leaving four views over the
 * `invitations` table — two by direction (Sent / Received) and two by terminal
 * status (Accepted / Rejected).
 */
import type { InvitationStatus } from '@/types/db';
import type { RequestItem } from '@/types/dto';

/** The four Requests tabs. `received` leads — it's the one with actions. */
export type RequestTab = 'received' | 'sent' | 'accepted' | 'rejected';

/** Tab definitions in display order. */
export const REQUEST_TABS: { key: RequestTab; label: string }[] = [
  { key: 'received', label: 'Received' },
  { key: 'sent', label: 'Sent' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
];

/**
 * Statuses a recipient can still act on. `clarifying` is included for forward
 * compatibility (its note-thread flow is deferred to chat), but is never produced
 * today. Kept as the single source of truth so the nav-badge SQL and this predicate
 * agree on what "actionable" means.
 */
export const ACTIONABLE_STATUSES: readonly InvitationStatus[] = [
  'pending',
  'clarifying',
];

/** A received request the current user can still accept or reject. */
export function isActionableReceived(item: RequestItem): boolean {
  return (
    item.direction === 'received' && ACTIONABLE_STATUSES.includes(item.status)
  );
}

/** The subset of requests shown under a given tab. */
export function filterByTab(
  items: RequestItem[],
  tab: RequestTab,
): RequestItem[] {
  switch (tab) {
    case 'sent':
      return items.filter((item) => item.direction === 'sent');
    case 'received':
      return items.filter((item) => item.direction === 'received');
    case 'accepted':
      return items.filter((item) => item.status === 'accepted');
    case 'rejected':
      return items.filter((item) => item.status === 'rejected');
  }
}

/** How many received requests still need a decision — drives the nav badge. */
export function receivedActionableCount(items: RequestItem[]): number {
  return items.filter(isActionableReceived).length;
}
