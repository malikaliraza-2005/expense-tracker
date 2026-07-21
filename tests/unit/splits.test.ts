import { describe, expect, it } from 'vitest';

import {
  computeSplit,
  recomputeEqualAfterRemoval,
  splitEqual,
  splitExact,
  splitPercentage,
  sumShares,
  SUPPORTED_SPLIT_TYPES,
} from '@/lib/splits';

/** Helper: assert a split succeeded and its shares sum exactly to the total. */
function expectSumsTo(result: ReturnType<typeof splitEqual>, total: number) {
  expect(result.ok).toBe(true);
  if (result.ok) expect(sumShares(result.shares)).toBe(total);
}

describe('splitEqual', () => {
  it('divides evenly when it divides cleanly', () => {
    const r = splitEqual(900, ['a', 'b', 'c']);
    expect(r).toEqual({
      ok: true,
      shares: [
        { userId: 'a', shareCents: 300 },
        { userId: 'b', shareCents: 300 },
        { userId: 'c', shareCents: 300 },
      ],
    });
  });

  it('gives the remainder cents to the earliest participants (100/3)', () => {
    const r = splitEqual(100, ['a', 'b', 'c']);
    expect(r.ok && r.shares.map((s) => s.shareCents)).toEqual([34, 33, 33]);
    expectSumsTo(r, 100);
  });

  it('always sums exactly to the total for tricky amounts', () => {
    for (const total of [1, 7, 101, 999, 1000, 12345]) {
      for (const n of [1, 2, 3, 4, 7]) {
        const ids = Array.from({ length: n }, (_, i) => `u${i}`);
        expectSumsTo(splitEqual(total, ids), total);
      }
    }
  });

  it('handles a zero total', () => {
    const r = splitEqual(0, ['a', 'b']);
    expect(r.ok && r.shares.every((s) => s.shareCents === 0)).toBe(true);
  });

  it('rejects an empty participant list', () => {
    expect(splitEqual(100, [])).toEqual({
      ok: false,
      error: 'At least one participant is required.',
    });
  });

  it('rejects a negative or non-integer total', () => {
    expect(splitEqual(-5, ['a']).ok).toBe(false);
    expect(splitEqual(10.5, ['a']).ok).toBe(false);
  });
});

describe('splitExact', () => {
  it('accepts shares that sum to the total', () => {
    const r = splitExact(100, [
      { userId: 'a', shareCents: 60 },
      { userId: 'b', shareCents: 40 },
    ]);
    expectSumsTo(r, 100);
  });

  it('rejects shares that do not sum to the total', () => {
    const r = splitExact(100, [
      { userId: 'a', shareCents: 60 },
      { userId: 'b', shareCents: 30 },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('add up to the total');
  });

  it('rejects a negative share', () => {
    expect(
      splitExact(100, [
        { userId: 'a', shareCents: 110 },
        { userId: 'b', shareCents: -10 },
      ]).ok,
    ).toBe(false);
  });
});

describe('splitPercentage', () => {
  it('resolves 1000 across [33.33, 33.33, 33.34] to [333, 333, 334]', () => {
    const r = splitPercentage(1000, [
      { userId: 'a', percent: 33.33 },
      { userId: 'b', percent: 33.33 },
      { userId: 'c', percent: 33.34 },
    ]);
    expect(r.ok && r.shares.map((s) => s.shareCents)).toEqual([333, 333, 334]);
    expectSumsTo(r, 1000);
  });

  it('gives leftover cents to the largest fractional remainders and stays exact', () => {
    expectSumsTo(
      splitPercentage(10, [
        { userId: 'a', percent: 25 },
        { userId: 'b', percent: 25 },
        { userId: 'c', percent: 50 },
      ]),
      10,
    );
  });

  it('rejects percentages that do not sum to 100', () => {
    const r = splitPercentage(1000, [
      { userId: 'a', percent: 40 },
      { userId: 'b', percent: 40 },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('add up to 100%');
  });

  it('tolerates tiny float drift near 100', () => {
    expect(
      splitPercentage(999, [
        { userId: 'a', percent: 33.33 },
        { userId: 'b', percent: 33.33 },
        { userId: 'c', percent: 33.34 },
      ]).ok,
    ).toBe(true);
  });
});

describe('recomputeEqualAfterRemoval', () => {
  it('recomputes equal shares over the remaining members', () => {
    // 90 across a/b/c (30 each); remove c → 45/45 over a/b.
    const r = recomputeEqualAfterRemoval({
      amountCents: 90,
      memberIds: ['a', 'b', 'c'],
      removeId: 'c',
      payerId: 'a',
    });
    expect(r).toEqual({
      ok: true,
      shares: [
        { userId: 'a', shareCents: 45 },
        { userId: 'b', shareCents: 45 },
      ],
    });
  });

  it('redistributes the remainder after removal and stays exact', () => {
    // 100 across a/b/c/d; remove d → 100/3 = 34,33,33 over a/b/c.
    const r = recomputeEqualAfterRemoval({
      amountCents: 100,
      memberIds: ['a', 'b', 'c', 'd'],
      removeId: 'd',
      payerId: 'a',
    });
    expect(r.ok && r.shares.map((s) => s.shareCents)).toEqual([34, 33, 33]);
    expect(r.ok && sumShares(r.shares)).toBe(100);
  });

  it('blocks removing the payer', () => {
    const r = recomputeEqualAfterRemoval({
      amountCents: 90,
      memberIds: ['a', 'b', 'c'],
      removeId: 'a',
      payerId: 'a',
    });
    expect(r).toEqual({
      ok: false,
      error: 'You can’t remove the person who paid.',
    });
  });

  it('blocks removing down to a single participant', () => {
    const r = recomputeEqualAfterRemoval({
      amountCents: 90,
      memberIds: ['a', 'b'],
      removeId: 'b',
      payerId: 'a',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('at least two people');
  });

  it('rejects removing someone who isn’t a participant', () => {
    const r = recomputeEqualAfterRemoval({
      amountCents: 90,
      memberIds: ['a', 'b', 'c'],
      removeId: 'z',
      payerId: 'a',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('isn’t part of this expense');
  });
});

describe('computeSplit dispatch', () => {
  it('routes each split type to the right engine', () => {
    expect(
      computeSplit({ type: 'equal', amountCents: 100, userIds: ['a', 'b'] }).ok,
    ).toBe(true);
    expect(
      computeSplit({
        type: 'exact',
        amountCents: 100,
        shares: [{ userId: 'a', shareCents: 100 }],
      }).ok,
    ).toBe(true);
    expect(
      computeSplit({
        type: 'percentage',
        amountCents: 100,
        weights: [{ userId: 'a', percent: 100 }],
      }).ok,
    ).toBe(true);
  });

  it('exposes the three supported split types', () => {
    expect(SUPPORTED_SPLIT_TYPES).toEqual(['equal', 'exact', 'percentage']);
  });
});
