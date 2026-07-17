import { describe, expect, it } from 'vitest';

import {
  REQUEST_TABS,
  filterByTab,
  isActionableReceived,
  receivedActionableCount,
} from '@/lib/requests';
import type { RequestItem } from '@/types/dto';

/**
 * Phase 5 — pure Requests rules. `filterByTab` slices the flat invitation list per
 * section (Received/Sent by direction, Accepted/Rejected by status); the two
 * "actionable" helpers decide what still needs a decision and drive the nav badge.
 */

function make(overrides: Partial<RequestItem>): RequestItem {
  return {
    id: 'id',
    token: 'tok',
    direction: 'received',
    kind: 'friend',
    status: 'pending',
    email: 'a@b.com',
    counterpartyName: 'Alex',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// A representative mix covering both directions and every terminal status.
const items: RequestItem[] = [
  make({ id: 'r1', direction: 'received', status: 'pending' }),
  make({ id: 'r2', direction: 'received', status: 'accepted' }),
  make({ id: 'r3', direction: 'sent', status: 'pending' }),
  make({ id: 'r4', direction: 'sent', status: 'rejected' }),
  make({ id: 'r5', direction: 'received', status: 'rejected' }),
  make({ id: 'r6', direction: 'sent', status: 'accepted' }),
];

const ids = (list: RequestItem[]) => list.map((item) => item.id);

describe('filterByTab', () => {
  it('Received / Sent are keyed by direction, ignoring status', () => {
    expect(ids(filterByTab(items, 'received'))).toEqual(['r1', 'r2', 'r5']);
    expect(ids(filterByTab(items, 'sent'))).toEqual(['r3', 'r4', 'r6']);
  });

  it('Accepted / Rejected are keyed by status, across both directions', () => {
    expect(ids(filterByTab(items, 'accepted'))).toEqual(['r2', 'r6']);
    expect(ids(filterByTab(items, 'rejected'))).toEqual(['r4', 'r5']);
  });
});

describe('isActionableReceived', () => {
  it('is true only for a received request still awaiting a decision', () => {
    expect(
      isActionableReceived(make({ direction: 'received', status: 'pending' })),
    ).toBe(true);
    expect(
      isActionableReceived(
        make({ direction: 'received', status: 'clarifying' }),
      ),
    ).toBe(true);
  });

  it('is false once decided, or for anything the current user sent', () => {
    expect(
      isActionableReceived(make({ direction: 'received', status: 'accepted' })),
    ).toBe(false);
    expect(
      isActionableReceived(make({ direction: 'received', status: 'expired' })),
    ).toBe(false);
    // A pending request you sent is not yours to accept.
    expect(
      isActionableReceived(make({ direction: 'sent', status: 'pending' })),
    ).toBe(false);
  });
});

describe('receivedActionableCount', () => {
  it('counts only received requests still awaiting a decision', () => {
    // Of the mix, only r1 (received + pending) is actionable.
    expect(receivedActionableCount(items)).toBe(1);
  });

  it('is zero for an empty list', () => {
    expect(receivedActionableCount([])).toBe(0);
  });
});

describe('REQUEST_TABS', () => {
  it('leads with Received — the tab that carries actions', () => {
    expect(REQUEST_TABS.map((tab) => tab.key)).toEqual([
      'received',
      'sent',
      'accepted',
      'rejected',
    ]);
  });
});
