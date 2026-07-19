import { describe, expect, it } from 'vitest';

import {
  DEPTH_KEY,
  readDepth,
  resolveDepth,
  stampDepth,
  type DepthCursor,
} from '@/lib/nav-history';

/**
 * The rule behind the header's back arrow: how many of OUR pages sit behind the
 * current history entry. Depth 0 means the user entered the app here, so the arrow
 * must route to the dashboard rather than call `router.back()` and leave the site.
 *
 * These replay the sequences a real visit produces — the browser hands the stamped
 * state back on a pop or a reload, and hands back an unstamped one on a push.
 */

/** A history entry the router pushed but we haven't numbered yet. */
const FRESH = { __NA: true, tree: ['expenses'] };

/** The cursor as it stands before the first entry of a visit is seen. */
const START: DepthCursor = { entered: false, lastDepth: 0 };

describe('readDepth', () => {
  it('reads a stamp we wrote', () => {
    expect(readDepth({ [DEPTH_KEY]: 3 })).toBe(3);
    expect(readDepth({ [DEPTH_KEY]: 0 })).toBe(0);
  });

  it('reports an unstamped entry as null', () => {
    expect(readDepth(FRESH)).toBeNull();
    expect(readDepth({})).toBeNull();
    expect(readDepth(null)).toBeNull();
    expect(readDepth(undefined)).toBeNull();
  });

  it('rejects a malformed stamp rather than trusting it', () => {
    // The bag is shared with the router and survives reloads, so it isn't ours to
    // assume well-formed. Anything odd is treated as "not numbered yet".
    expect(readDepth({ [DEPTH_KEY]: '2' })).toBeNull();
    expect(readDepth({ [DEPTH_KEY]: -1 })).toBeNull();
    expect(readDepth({ [DEPTH_KEY]: 1.5 })).toBeNull();
    expect(readDepth({ [DEPTH_KEY]: NaN })).toBeNull();
    expect(readDepth({ [DEPTH_KEY]: null })).toBeNull();
  });
});

describe('resolveDepth', () => {
  it('numbers the entry point 0 — nothing of ours is behind it', () => {
    // Landing from an invite email or a shared link: the router pushed nothing,
    // this page IS the visit. `history.length` would be 2 here (the referring site
    // is still in the tab) and wrongly say we can go back.
    expect(resolveDepth(FRESH, START)).toBe(0);
  });

  it('numbers each pushed entry one deeper than the last', () => {
    expect(resolveDepth(FRESH, { entered: true, lastDepth: 0 })).toBe(1);
    expect(resolveDepth(FRESH, { entered: true, lastDepth: 4 })).toBe(5);
  });

  it('gives a stamped entry back its own number, not a new one', () => {
    // A back/forward: the browser restored the state we wrote, so the entry keeps
    // the depth it was pushed with instead of counting up again.
    expect(resolveDepth({ [DEPTH_KEY]: 0 }, { entered: true, lastDepth: 1 })).toBe(0);
    expect(resolveDepth({ [DEPTH_KEY]: 2 }, { entered: true, lastDepth: 5 })).toBe(2);
  });

  it('survives a reload of a deep page', () => {
    // History state persists across a refresh, so the stamp is still there and the
    // arrow keeps working — `entered` is false again, but the stamp wins.
    expect(resolveDepth({ [DEPTH_KEY]: 3 }, START)).toBe(3);
  });
});

describe('a visit that arrives from outside', () => {
  /** Replay a sequence of entries, threading the cursor as the hook does. */
  function walk(states: Array<Record<string, unknown>>): number[] {
    const cursor: DepthCursor = { entered: false, lastDepth: 0 };
    return states.map((state) => {
      const depth = resolveDepth(state, { ...cursor });
      cursor.entered = true;
      cursor.lastDepth = depth;
      return depth;
    });
  }

  it('only allows back once the reader has moved within the app', () => {
    // Gmail → /expenses/abc (entry, 0) → /expenses/abc/edit (1) → back (0).
    // The final 0 is the bug this fixes: the old `history.length > 1` check stayed
    // true here and the arrow returned the reader to Gmail.
    const stampedEntry = { ...FRESH, [DEPTH_KEY]: 0 };
    expect(walk([FRESH, FRESH, stampedEntry])).toEqual([0, 1, 0]);
  });

  it('counts a deeper trail back down one entry at a time', () => {
    const at = (depth: number) => ({ ...FRESH, [DEPTH_KEY]: depth });
    expect(walk([FRESH, FRESH, FRESH, at(1), at(0)])).toEqual([0, 1, 2, 1, 0]);
  });
});

describe('stampDepth', () => {
  it('adds our marker', () => {
    expect(stampDepth({}, 2)).toEqual({ [DEPTH_KEY]: 2 });
    expect(stampDepth(null, 0)).toEqual({ [DEPTH_KEY]: 0 });
  });

  it("keeps the router's own keys", () => {
    // Replacing the bag instead of merging would drop Next's tree and scroll data,
    // breaking the navigation we're trying to measure.
    expect(stampDepth(FRESH, 1)).toEqual({
      __NA: true,
      tree: ['expenses'],
      [DEPTH_KEY]: 1,
    });
  });

  it('overwrites a stale marker rather than keeping two', () => {
    expect(stampDepth({ [DEPTH_KEY]: 9 }, 1)).toEqual({ [DEPTH_KEY]: 1 });
  });

  it('does not mutate the state it was given', () => {
    const state = { __NA: true };
    stampDepth(state, 1);
    expect(state).toEqual({ __NA: true });
  });
});
