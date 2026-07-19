/**
 * In-app history depth — the rule behind the header's back arrow.
 *
 * The arrow needs one fact: is the entry BEHIND this one ours? `window.history`
 * can't answer that. `history.length` counts the whole tab's history including
 * other origins, and it never shrinks when you go back, so it conflates "pages
 * ahead of me" with "pages behind me". Arriving from an invite email in the same
 * tab makes `length` 2, and a `length > 1` test then reports "we can go back" —
 * ejecting the reader to their inbox, the exact case the check existed to catch.
 *
 * So we number the entries ourselves: each one is stamped with how many of our
 * pages sit behind it, at the moment the router pushes it. Depth 0 is where the
 * user entered the app — going back from there leaves the site.
 *
 * The stamp rides on the entry's own history state, which the browser restores on
 * back/forward and across a reload, so the number survives both without a store
 * to keep in sync. A freshly pushed entry carries no stamp — that absence is
 * exactly how a push is told apart from a pop.
 *
 * Pure and side-effect free: it reads and returns plain state objects and never
 * touches `window`, so the rule is unit-verifiable in isolation. {@link
 * useNavDepth} is the thin React wrapper that binds it to real history.
 */

/** Our marker on a history entry. Namespaced to avoid colliding with the router's keys. */
export const DEPTH_KEY = '__etNavDepth';

/** A history entry's state bag, as `window.history.state` hands it to us. */
export type HistoryState = Record<string, unknown> | null | undefined;

/**
 * The depth stamped on an entry, or `null` when we haven't numbered it yet.
 *
 * Null means "freshly pushed by the router". Anything that isn't a non-negative
 * integer is treated as unstamped rather than trusted: the state bag is shared
 * with the router and survives reloads, so it is not ours to assume well-formed.
 */
export function readDepth(state: HistoryState): number | null {
  const value = (state ?? {})[DEPTH_KEY];
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

/** What {@link resolveDepth} needs to remember between navigations. */
export interface DepthCursor {
  /** Whether we've already seen an entry this visit. False only on first paint. */
  entered: boolean;
  /** The depth of the entry we last saw — what a newly pushed one counts from. */
  lastDepth: number;
}

/**
 * The depth of the entry the router just moved us to.
 *
 * An entry we've already stamped is a back/forward or a reload, and keeps its
 * number. An unstamped one was just pushed: it sits one deeper than wherever we
 * came from, unless it's the first entry of the visit — that's the entry point,
 * depth 0, and there's nothing of ours behind it.
 */
export function resolveDepth(
  state: HistoryState,
  { entered, lastDepth }: DepthCursor,
): number {
  const stamped = readDepth(state);
  if (stamped !== null) return stamped;
  return entered ? lastDepth + 1 : 0;
}

/**
 * Merge our marker into an entry's state. Spreads the existing bag rather than
 * replacing it so the router's own keys (its tree, its scroll data) survive —
 * dropping them would break the navigation we're trying to measure.
 */
export function stampDepth(
  state: HistoryState,
  depth: number,
): Record<string, unknown> {
  return { ...(state ?? {}), [DEPTH_KEY]: depth };
}
