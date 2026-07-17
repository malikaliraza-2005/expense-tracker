import { describe, expect, it } from 'vitest';

import {
  activityCategory,
  activityHref,
  describeActivity,
  formatAmount,
  unreadCount,
} from '@/lib/activity';
import type { ActivityType } from '@/types/db';
import type { ActivityItem } from '@/types/dto';

/**
 * Phase 1 — pure Activity rules. `describeActivity` turns a denormalized event into a
 * viewer-relative sentence ("You" vs. the actor's name); `activityCategory` and
 * `unreadCount` drive the icon and the entry-point badge.
 */

const ME = 'me-1';
const OTHER = 'other-1';

function ev(overrides: Partial<ActivityItem>): ActivityItem {
  return {
    id: 'a1',
    type: 'expense_created',
    actorId: ME,
    actorName: 'Alex',
    subject: 'Dinner',
    expenseId: 'e1',
    groupId: null,
    memberId: null,
    settlementId: null,
    contextLabel: null,
    amountCents: null,
    currency: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    readAt: null,
    ...overrides,
  };
}

describe('activityCategory', () => {
  it('maps each type to its icon family', () => {
    const cases: [ActivityType, string][] = [
      ['expense_created', 'expense'],
      ['group_added_you', 'group'],
      ['settlement_recorded', 'settlement'],
      ['friend_added', 'friend'],
      ['balance_changed', 'balance'],
    ];
    for (const [type, cat] of cases) expect(activityCategory(type)).toBe(cat);
  });
});

describe('describeActivity', () => {
  it('renders self actions as "You"', () => {
    expect(describeActivity(ev({ type: 'expense_created', actorId: ME }), ME)).toBe(
      'You added “Dinner”',
    );
    expect(describeActivity(ev({ type: 'group_created', subject: 'Trip', actorId: ME }), ME)).toBe(
      'You created “Trip”',
    );
  });

  it('renders others actions with the actor name', () => {
    expect(
      describeActivity(ev({ type: 'expense_updated', actorId: OTHER, actorName: 'Ahmed' }), ME),
    ).toBe('Ahmed edited “Dinner”');
    expect(
      describeActivity(ev({ type: 'expense_deleted', actorId: OTHER, actorName: 'Bilal', subject: 'Lunch' }), ME),
    ).toBe('Bilal deleted “Lunch”');
  });

  it('always addresses "added you" / "removed you" to the recipient', () => {
    expect(
      describeActivity(ev({ type: 'expense_added_you', actorId: OTHER, actorName: 'Ali', subject: 'Dinner' }), ME),
    ).toBe('Ali added you to “Dinner”');
    expect(
      describeActivity(ev({ type: 'group_removed_you', actorId: OTHER, actorName: 'Ahmed', subject: 'Family' }), ME),
    ).toBe('Ahmed removed you from “Family”');
  });

  it('formats settlement amounts both directions', () => {
    expect(
      describeActivity(
        ev({ type: 'settlement_recorded', actorId: ME, subject: 'Ali', amountCents: 200000, currency: 'PKR' }),
        ME,
      ),
    ).toBe('You settled PKR 2,000 with Ali');
    expect(
      describeActivity(
        ev({ type: 'settlement_received', actorId: OTHER, actorName: 'Ali', amountCents: 200000, currency: 'PKR' }),
        ME,
      ),
    ).toBe('Ali settled PKR 2,000 with you');
  });

  it('renders friend adds', () => {
    expect(
      describeActivity(ev({ type: 'friend_added', actorId: ME, subject: 'Ahmed' }), ME),
    ).toBe('You added Ahmed as a friend');
  });

  it('degrades missing name/subject to neutral text (never "undefined")', () => {
    const line = describeActivity(
      ev({ type: 'expense_added_you', actorId: OTHER, actorName: null, subject: null }),
      ME,
    );
    expect(line).toBe('Someone added you to “an item”');
    expect(line).not.toMatch(/undefined|null/);
  });
});

describe('describeActivity — settlement context', () => {
  it('names where the settlement happened, matching the notification format', () => {
    expect(
      describeActivity(
        ev({
          type: 'settlement_recorded',
          actorId: ME,
          subject: 'Ahmed',
          amountCents: 250000,
          currency: 'PKR',
          contextLabel: 'Trip to Naran',
          expenseId: null,
          groupId: 'g1',
        }),
        ME,
      ),
    ).toBe('You settled PKR 2,500 with Ahmed in “Trip to Naran”');

    expect(
      describeActivity(
        ev({
          type: 'settlement_received',
          actorId: OTHER,
          actorName: 'Ali',
          amountCents: 250000,
          currency: 'PKR',
          contextLabel: 'Trip to Naran',
          expenseId: null,
          groupId: 'g1',
        }),
        ME,
      ),
    ).toBe('Ali settled PKR 2,500 with you in “Trip to Naran”');
  });

  it('omits the context when there is none (a non-group settlement)', () => {
    expect(
      describeActivity(
        ev({
          type: 'settlement_recorded',
          actorId: ME,
          subject: 'Ali',
          amountCents: 200000,
          currency: 'PKR',
          contextLabel: null,
          expenseId: null,
        }),
        ME,
      ),
    ).toBe('You settled PKR 2,000 with Ali');
  });
});

describe('activityHref', () => {
  it('opens the expense for expense events', () => {
    expect(activityHref(ev({ type: 'expense_added_you', expenseId: 'e9' }))).toBe(
      '/expenses/e9',
    );
  });

  it('opens the group for group events', () => {
    expect(
      activityHref(ev({ type: 'group_added_you', expenseId: null, groupId: 'g9' })),
    ).toBe('/groups/g9');
  });

  it('opens the expense first, then the group, for a settlement', () => {
    expect(
      activityHref(ev({ type: 'settlement_recorded', expenseId: 'e9', groupId: 'g9' })),
    ).toBe('/expenses/e9');
    expect(
      activityHref(ev({ type: 'settlement_recorded', expenseId: null, groupId: 'g9' })),
    ).toBe('/groups/g9');
  });

  it('sends a non-group settlement to the expenses with that person', () => {
    // Not tied to an expense or group — the reader still lands on the thing it's
    // about, rather than a bare Friends list they'd have to search.
    expect(
      activityHref(
        ev({ type: 'settlement_recorded', expenseId: null, groupId: null, memberId: 'm9' }),
      ),
    ).toBe('/expenses?who=m9');
    expect(
      activityHref(
        ev({ type: 'settlement_received', expenseId: null, groupId: null, memberId: 'm9' }),
      ),
    ).toBe('/expenses?who=m9');
  });

  it('falls back to Friends only when there is nothing to point at', () => {
    expect(
      activityHref(
        ev({ type: 'settlement_recorded', expenseId: null, groupId: null, memberId: null }),
      ),
    ).toBe('/friends');
    expect(
      activityHref(ev({ type: 'friend_added', expenseId: null, groupId: null })),
    ).toBe('/friends');
  });

  it('is null when the entity was deleted (nothing to open)', () => {
    expect(
      activityHref(ev({ type: 'expense_deleted', expenseId: null, groupId: null })),
    ).toBeNull();
  });
});

describe('formatAmount', () => {
  it('formats cents with a currency code and thousands separators', () => {
    expect(formatAmount(200000, 'PKR')).toBe('PKR 2,000');
    expect(formatAmount(-85050, 'USD')).toBe('USD 850.5');
    expect(formatAmount(500, null)).toBe('5');
  });
});

describe('unreadCount', () => {
  it('counts only events with a null readAt', () => {
    const items = [
      ev({ id: '1', readAt: null }),
      ev({ id: '2', readAt: '2026-01-02T00:00:00.000Z' }),
      ev({ id: '3', readAt: null }),
    ];
    expect(unreadCount(items)).toBe(2);
    expect(unreadCount([])).toBe(0);
  });
});
