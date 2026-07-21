/**
 * Activity logic — pure, dependency-free rules shared by the Activity page (rendering
 * events into sentences, choosing an icon) and its tests. Kept out of the query/action
 * layer so it runs identically on the server and in the browser, with no Supabase
 * dependency.
 *
 * An event's display strings are denormalized onto the row (`actorName`, `subject`,
 * `amountCents`), so describing one needs no extra reads — only the viewer's account id
 * to decide "You" vs. the actor's name.
 */
import { ROUTES } from '@/constants/routes';
import type { ActivityType } from '@/types/db';
import type { ActivityItem } from '@/types/dto';

/** A coarse category, used to pick an icon / accent on the Activity row. */
export type ActivityCategory =
  | 'expense'
  | 'group'
  | 'settlement'
  | 'friend'
  | 'chat'
  | 'balance';

/** The icon family an activity belongs to. */
export function activityCategory(type: ActivityType): ActivityCategory {
  if (type.startsWith('expense_')) return 'expense';
  if (type.startsWith('group_')) return 'group';
  if (type.startsWith('settlement_')) return 'settlement';
  if (type.startsWith('friend_')) return 'friend';
  if (type.startsWith('chat_')) return 'chat';
  return 'balance';
}

/** Format integer cents as a plain amount with an optional currency code. */
export function formatAmount(
  amountCents: number | null,
  currency: string | null,
): string {
  const value = (Math.abs(amountCents ?? 0) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${value}` : value;
}

/**
 * Render an activity event into a human sentence from the current user's point of
 * view. `meId` is the viewer's account id: events they performed read as "You …",
 * others read with the actor's name. A missing subject/name degrades to a neutral
 * fallback so the line never shows "undefined".
 */
export function describeActivity(item: ActivityItem, meId: string): string {
  const isSelf = item.actorId != null && item.actorId === meId;
  const actor = item.actorName?.trim() || 'Someone';
  const subject = item.subject?.trim() || 'an item';
  const who = isSelf ? 'You' : actor;
  const money = formatAmount(item.amountCents, item.currency);
  // " in “Trip to Naran”" — appended to settlement lines when we know where it
  // happened, per the notification format.
  const context = item.contextLabel?.trim()
    ? ` in “${item.contextLabel.trim()}”`
    : '';

  switch (item.type) {
    case 'expense_created':
      return `${who} added “${subject}”`;
    case 'expense_added_you':
      // Say what it means for the reader, so they don't have to open it to find out.
      // Signed like every other balance: negative = they owe.
      if (item.amountCents == null || item.amountCents === 0) {
        return `${actor} added you to “${subject}”`;
      }
      return item.amountCents < 0
        ? `${actor} added you to “${subject}” — you owe ${money}`
        : `${actor} added you to “${subject}” — you’re owed ${money}`;
    case 'expense_updated':
      return `${who} edited “${subject}”`;
    case 'expense_deleted':
      return `${who} deleted “${subject}”`;
    case 'group_created':
      return `${who} created the group “${subject}”`;
    case 'group_added_you':
      return `${actor} added you to the group “${subject}”`;
    case 'group_removed_you':
      return `${actor} removed you from the group “${subject}”`;
    case 'group_left':
      return `${who} left the group “${subject}”`;
    case 'settlement_recorded':
      return `${who} settled ${money} with ${subject}${context}`;
    case 'settlement_received':
      return `${actor} settled ${money} with you${context}`;
    case 'chat_message':
      // One entry per thread, bumped while unread — so it reads as "there's
      // conversation here", not as a transcript.
      return `${actor} sent a message on “${subject}”${context}`;
    case 'friend_added':
      return `${who} added ${subject} as a friend`;
    case 'friend_removed':
      return `${who} removed ${subject} from your friends`;
    case 'balance_changed':
      return subject; // subject carries the full pre-formatted balance line
    default:
      return subject;
  }
}

/** How many events in a list are unread — drives the entry-point badge. */
export function unreadCount(items: ActivityItem[]): number {
  return items.filter((item) => item.readAt === null).length;
}

/**
 * Where an activity row navigates to — its related resource, so a notification never
 * leaves the reader hunting for the thing it's about:
 *
 *   - expense events    → that expense
 *   - group events      → that group
 *   - settlements       → the expense it settled, else the group it was in, else the
 *                         non-group expenses with that person
 *   - friend events     → Friends
 *
 * A settlement is the subtle one: it may be scoped to an expense, to a group, or to
 * neither (an overall balance with one person). In that last case the thing it's
 * "about" is the non-group expenses shared with them, which `/expenses?who=` shows —
 * landing on the bare Friends list would make the reader hunt for it.
 *
 * Derived from the ids already on the row rather than a stored link, so it can't go
 * stale if routes change. Returns null when the target no longer exists (the entity
 * was deleted and its id nulled out) — the row then renders as plain, non-clickable
 * history.
 */
export function activityHref(item: ActivityItem): string | null {
  // Checked BEFORE the ids: these two events are *about losing access*. The group row
  // still exists, so `groupId` is set and would happily produce a link — but you were
  // removed from (or left) it, so RLS no longer lets you open it and the page 404s.
  // Non-clickable history is the honest rendering.
  if (item.type === 'group_removed_you' || item.type === 'group_left') return null;

  if (item.expenseId) return `${ROUTES.expenses}/${item.expenseId}`;
  if (item.groupId) return `${ROUTES.groups}/${item.groupId}`;

  switch (activityCategory(item.type)) {
    case 'settlement':
      // Not tied to an expense or group: show the non-group expenses with them.
      return item.memberId
        ? `${ROUTES.expenses}?who=${item.memberId}`
        : ROUTES.friends;
    case 'friend':
      return ROUTES.friends;
    case 'group':
    case 'expense':
      // The entity was deleted (its id was nulled) — nothing to open.
      return null;
    default:
      return null;
  }
}
