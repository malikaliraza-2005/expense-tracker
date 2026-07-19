import { describe, expect, it } from 'vitest';

import {
  DM_FALLBACK_NAME,
  previewLine,
  toDirectMessage,
  toDmConversation,
  totalUnread,
  type DmThreadListRow,
} from '@/lib/dm';
import { mergeMessage, replaceMessage, sortMessages } from '@/lib/chat';
import type { DirectMessage, DmConversation } from '@/types/dto';

/**
 * Phase 1 (DMs) — pure rules. Row → DTO projection, conversation-list shaping (name
 * resolution, "You:" preview, unread rollup), and a check that the shared merge/sort
 * engine from `@/lib/chat` orders a DirectMessage the same way it orders chat.
 */

function dm(overrides: Partial<DirectMessage>): DirectMessage {
  return {
    id: 'm1',
    threadId: 't1',
    senderId: 'u1',
    body: 'hi',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function row(overrides: Partial<DmThreadListRow>): DmThreadListRow {
  return {
    thread_id: 't1',
    other_user_id: 'other',
    last_body: 'hey',
    last_at: '2026-01-01T00:00:00.000Z',
    last_sender_id: 'other',
    unread_count: 2,
    ...overrides,
  };
}

describe('toDirectMessage', () => {
  it('camel-cases a dm_messages row', () => {
    expect(
      toDirectMessage({
        id: 'a',
        thread_id: 't9',
        sender_id: 'u2',
        body: 'yo',
        created_at: '2026-02-02T00:00:00.000Z',
        deleted_at: null,
      }),
    ).toEqual({
      id: 'a',
      threadId: 't9',
      senderId: 'u2',
      body: 'yo',
      createdAt: '2026-02-02T00:00:00.000Z',
      deletedAt: null,
    });
  });

  it('carries a deleted_at through as deletedAt (tombstone)', () => {
    const m = toDirectMessage({
      id: 'a',
      thread_id: 't9',
      sender_id: 'u2',
      body: 'This message was deleted',
      created_at: '2026-02-02T00:00:00.000Z',
      deleted_at: '2026-02-02T00:05:00.000Z',
    });
    expect(m.deletedAt).toBe('2026-02-02T00:05:00.000Z');
  });
});

describe('toDmConversation', () => {
  it('resolves the other party name from the roster', () => {
    const c = toDmConversation(row({ other_user_id: 'bob' }), 'me', (id) =>
      id === 'bob' ? 'Bob' : undefined,
    );
    expect(c.otherName).toBe('Bob');
    expect(c.otherUserId).toBe('bob');
  });

  it('falls back when the partner is not in the roster under a name', () => {
    const c = toDmConversation(row({}), 'me', () => undefined);
    expect(c.otherName).toBe(DM_FALLBACK_NAME);
  });

  it('flags the last message as mine only when I sent it', () => {
    expect(
      toDmConversation(row({ last_sender_id: 'me' }), 'me', () => 'X').lastFromMe,
    ).toBe(true);
    expect(
      toDmConversation(row({ last_sender_id: 'other' }), 'me', () => 'X')
        .lastFromMe,
    ).toBe(false);
  });

  it('coalesces a null unread count to zero', () => {
    expect(
      toDmConversation(row({ unread_count: null }), 'me', () => 'X').unreadCount,
    ).toBe(0);
  });
});

describe('previewLine', () => {
  const base: DmConversation = {
    threadId: 't1',
    otherUserId: 'other',
    otherName: 'Bob',
    lastBody: 'hey',
    lastAt: '2026-01-01T00:00:00.000Z',
    lastFromMe: false,
    unreadCount: 0,
  };

  it('prefixes with "You: " when the viewer sent the last message', () => {
    expect(previewLine({ ...base, lastFromMe: true })).toBe('You: hey');
  });

  it('shows the bare body when the other party sent it', () => {
    expect(previewLine(base)).toBe('hey');
  });

  it('shows a placeholder for an empty thread', () => {
    expect(previewLine({ ...base, lastBody: null })).toBe('No messages yet');
  });
});

describe('totalUnread', () => {
  it('sums unread across conversations', () => {
    const mk = (n: number): DmConversation => ({
      threadId: `t${n}`,
      otherUserId: 'o',
      otherName: 'O',
      lastBody: 'x',
      lastAt: null,
      lastFromMe: false,
      unreadCount: n,
    });
    expect(totalUnread([mk(2), mk(0), mk(3)])).toBe(5);
    expect(totalUnread([])).toBe(0);
  });
});

describe('shared ordering engine over DirectMessage', () => {
  it('sorts oldest-first, tie-broken by id', () => {
    const a = dm({ id: 'a', createdAt: '2026-01-01T00:00:02.000Z' });
    const b = dm({ id: 'b', createdAt: '2026-01-01T00:00:01.000Z' });
    const c = dm({ id: 'c', createdAt: '2026-01-01T00:00:01.000Z' });
    expect(sortMessages([a, b, c]).map((m) => m.id)).toEqual(['b', 'c', 'a']);
  });

  it('de-dupes a realtime echo by id', () => {
    const list = [dm({ id: 'a' })];
    expect(mergeMessage(list, dm({ id: 'a', body: 'echo' }))).toHaveLength(1);
  });

  it('swaps an optimistic message for its persisted counterpart', () => {
    const list = [dm({ id: 'temp-1', pending: true }), dm({ id: 'a' })];
    const real = dm({ id: 'real-1', createdAt: '2026-01-01T00:00:05.000Z' });
    const next = replaceMessage(list, 'temp-1', real);
    expect(next.map((m) => m.id)).toEqual(['a', 'real-1']);
    expect(next.some((m) => m.pending)).toBe(false);
  });
});
