import { describe, expect, it } from 'vitest';

import {
  MAX_MESSAGE_LENGTH,
  compareMessages,
  isSendableBody,
  mergeMessage,
  normalizeBody,
  replaceMessage,
  sortMessages,
} from '@/lib/chat';
import type { ChatMessage } from '@/types/dto';

/**
 * Phase 6 — pure chat rules. `isSendableBody`/`normalizeBody` gate what may be sent;
 * the merge/replace/sort helpers keep the thread stable when a message arrives twice
 * (optimistic echo + realtime) or when an optimistic row is reconciled with its
 * persisted counterpart.
 */

function msg(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: 'm1',
    expenseId: 'e1',
    senderId: 'u1',
    body: 'hi',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('normalizeBody', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeBody('  hello  ')).toBe('hello');
    expect(normalizeBody('\n\they\n')).toBe('hey');
  });
});

describe('isSendableBody', () => {
  it('accepts non-empty text and emoji within the cap', () => {
    expect(isSendableBody('hello')).toBe(true);
    expect(isSendableBody('🎉👍')).toBe(true);
    expect(isSendableBody('a')).toBe(true);
  });

  it('rejects empty or whitespace-only bodies', () => {
    expect(isSendableBody('')).toBe(false);
    expect(isSendableBody('   ')).toBe(false);
    expect(isSendableBody('\n\t')).toBe(false);
  });

  it('rejects bodies longer than the cap once trimmed', () => {
    expect(isSendableBody('x'.repeat(MAX_MESSAGE_LENGTH))).toBe(true);
    expect(isSendableBody('x'.repeat(MAX_MESSAGE_LENGTH + 1))).toBe(false);
    // Trailing whitespace doesn't count against the cap.
    expect(
      isSendableBody('x'.repeat(MAX_MESSAGE_LENGTH) + '   '),
    ).toBe(true);
  });
});

describe('compareMessages / sortMessages', () => {
  it('orders oldest-first by createdAt, tie-breaking by id', () => {
    const a = msg({ id: 'a', createdAt: '2026-01-01T00:00:02.000Z' });
    const b = msg({ id: 'b', createdAt: '2026-01-01T00:00:01.000Z' });
    const c = msg({ id: 'c', createdAt: '2026-01-01T00:00:01.000Z' });
    expect(sortMessages([a, b, c]).map((m) => m.id)).toEqual(['b', 'c', 'a']);
    expect(compareMessages(b, c)).toBeLessThan(0);
  });

  it('does not mutate its input', () => {
    const list = [
      msg({ id: 'a', createdAt: '2026-01-01T00:00:02.000Z' }),
      msg({ id: 'b', createdAt: '2026-01-01T00:00:01.000Z' }),
    ];
    sortMessages(list);
    expect(list.map((m) => m.id)).toEqual(['a', 'b']);
  });
});

describe('mergeMessage', () => {
  it('adds a new message and keeps the list sorted', () => {
    const list = [msg({ id: 'a', createdAt: '2026-01-01T00:00:01.000Z' })];
    const merged = mergeMessage(
      list,
      msg({ id: 'b', createdAt: '2026-01-01T00:00:00.000Z' }),
    );
    expect(merged.map((m) => m.id)).toEqual(['b', 'a']);
  });

  it('ignores a duplicate id (the realtime echo of an already-added message)', () => {
    const list = [msg({ id: 'a' })];
    const merged = mergeMessage(list, msg({ id: 'a', body: 'echo' }));
    expect(merged).toHaveLength(1);
    expect(merged[0].body).toBe('hi');
  });
});

describe('replaceMessage', () => {
  it('swaps an optimistic message for its persisted counterpart', () => {
    const list = [
      msg({ id: 'temp-1', body: 'hey', pending: true }),
      msg({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' }),
    ];
    const real = msg({
      id: 'real-1',
      body: 'hey',
      createdAt: '2026-01-01T00:00:05.000Z',
    });
    const next = replaceMessage(list, 'temp-1', real);
    expect(next.map((m) => m.id)).toEqual(['a', 'real-1']);
    expect(next.some((m) => m.pending)).toBe(false);
  });

  it('de-dupes when realtime already delivered the real message', () => {
    const real = msg({ id: 'real-1', body: 'hey' });
    const list = [msg({ id: 'temp-1', body: 'hey', pending: true }), real];
    const next = replaceMessage(list, 'temp-1', real);
    expect(next.map((m) => m.id)).toEqual(['real-1']);
  });
});
