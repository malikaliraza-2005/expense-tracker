/**
 * Split engine (Phase 2).
 *
 * Converts an expense total into exact, per-participant integer-cent shares for
 * each of the three supported split types. Pure and deterministic: given the
 * same input it always returns the same shares, and the shares ALWAYS sum
 * exactly to the total (the core invariant `sum(share_cents) == amount_cents`).
 *
 * Money is integer cents throughout — never floats. Percentages are the only
 * fractional inputs and are resolved to exact cents via the largest-remainder
 * method so nothing is lost or invented in rounding.
 *
 * This module has no I/O and no Supabase dependency; it is unit-verifiable in
 * isolation (see src/app/(app)/dev/balances/page.tsx).
 */
import type { SplitType } from '@/types/db';

/** A single participant's resolved share, in integer cents. */
export interface SplitShare {
  userId: string;
  shareCents: number;
}

/**
 * Result of a split computation. Expected failures (bad totals, percentages
 * that don't sum to 100, …) are returned rather than thrown so callers — server
 * actions — can surface an actionable message. See development-guidelines §6.
 */
export type SplitResult =
  | { ok: true; shares: SplitShare[] }
  | { ok: false; error: string };

/** Discriminated input describing what to split and how. */
export type SplitInput =
  | { type: 'equal'; amountCents: number; userIds: string[] }
  | {
      type: 'exact';
      amountCents: number;
      shares: ReadonlyArray<{ userId: string; shareCents: number }>;
    }
  | {
      type: 'percentage';
      amountCents: number;
      weights: ReadonlyArray<{ userId: string; percent: number }>;
    };

/** Sum a list of shares — the invariant checked against the total. */
export function sumShares(shares: ReadonlyArray<SplitShare>): number {
  return shares.reduce((total, s) => total + s.shareCents, 0);
}

function isValidTotal(amountCents: number): boolean {
  return Number.isInteger(amountCents) && amountCents >= 0;
}

/**
 * Equal split. Divides the total evenly, then distributes the indivisible
 * remainder one cent at a time to the earliest participants (stable by input
 * order) so the shares always sum to the total.
 *
 * Example: 100 / 3 → [34, 33, 33].
 */
export function splitEqual(
  amountCents: number,
  userIds: ReadonlyArray<string>,
): SplitResult {
  if (!isValidTotal(amountCents)) {
    return { ok: false, error: 'Amount must be a non-negative whole number of cents.' };
  }
  const n = userIds.length;
  if (n === 0) {
    return { ok: false, error: 'At least one participant is required.' };
  }

  const base = Math.floor(amountCents / n);
  let remainder = amountCents - base * n; // 0 <= remainder < n

  const shares = userIds.map((userId) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return { userId, shareCents: base + extra };
  });

  return { ok: true, shares };
}

/**
 * Exact split. Accepts caller-provided per-person cents and validates that they
 * sum exactly to the total. Nothing is redistributed — exact means exact.
 */
export function splitExact(
  amountCents: number,
  entries: ReadonlyArray<{ userId: string; shareCents: number }>,
): SplitResult {
  if (!isValidTotal(amountCents)) {
    return { ok: false, error: 'Amount must be a non-negative whole number of cents.' };
  }
  if (entries.length === 0) {
    return { ok: false, error: 'At least one participant is required.' };
  }
  for (const e of entries) {
    if (!Number.isInteger(e.shareCents) || e.shareCents < 0) {
      return { ok: false, error: 'Each share must be a non-negative whole number of cents.' };
    }
  }

  const shares = entries.map((e) => ({ userId: e.userId, shareCents: e.shareCents }));
  const total = sumShares(shares);
  if (total !== amountCents) {
    return {
      ok: false,
      error: `Shares must add up to the total. Got ${total} cents, expected ${amountCents} cents.`,
    };
  }

  return { ok: true, shares };
}

/**
 * Percentage split. Percentages must sum to 100. Each person's exact cent value
 * (`amount * percent / 100`) is floored, then the leftover cents are handed out
 * by the largest-remainder method — one cent to the largest fractional parts
 * first, ties broken by input order — so the result is deterministic and sums
 * exactly to the total.
 *
 * Example: 1000 with [33.33, 33.33, 33.34] → [333, 333, 334].
 */
export function splitPercentage(
  amountCents: number,
  entries: ReadonlyArray<{ userId: string; percent: number }>,
): SplitResult {
  if (!isValidTotal(amountCents)) {
    return { ok: false, error: 'Amount must be a non-negative whole number of cents.' };
  }
  if (entries.length === 0) {
    return { ok: false, error: 'At least one participant is required.' };
  }
  for (const e of entries) {
    if (!Number.isFinite(e.percent) || e.percent < 0) {
      return { ok: false, error: 'Each percentage must be a non-negative number.' };
    }
  }

  const percentTotal = entries.reduce((sum, e) => sum + e.percent, 0);
  // Guard against float drift (e.g. 33.33 + 33.33 + 33.34) with a tiny epsilon.
  if (Math.abs(percentTotal - 100) > 1e-6) {
    return {
      ok: false,
      error: `Percentages must add up to 100%. Got ${percentTotal}%.`,
    };
  }

  // Largest-remainder (Hamilton) apportionment.
  const raw = entries.map((e, index) => {
    const exact = (amountCents * e.percent) / 100;
    const floor = Math.floor(exact);
    return { userId: e.userId, index, floor, remainder: exact - floor };
  });

  let leftover = amountCents - raw.reduce((sum, r) => sum + r.floor, 0);

  // Distribute leftover cents to the largest fractional remainders first; break
  // ties by original position to stay stable.
  const order = [...raw].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index,
  );
  const bonus = new Set<number>();
  for (const r of order) {
    if (leftover <= 0) break;
    bonus.add(r.index);
    leftover -= 1;
  }

  const shares = raw.map((r) => ({
    userId: r.userId,
    shareCents: r.floor + (bonus.has(r.index) ? 1 : 0),
  }));

  return { ok: true, shares };
}

/**
 * Recompute an expense's equal splits after removing one participant, enforcing
 * the removal guards. Returns the fresh equal shares over the remaining members
 * (remainder redistributed by {@link splitEqual}), or an expected failure when
 * the removal isn't allowed:
 *   - the removed member isn't a participant,
 *   - the removed member is the payer (a payer can't owe themselves), or
 *   - the removal would leave fewer than two participants (nothing to split).
 *
 * Pure and math-only, so the removal path is unit-verifiable without a database.
 */
export function recomputeEqualAfterRemoval(input: {
  amountCents: number;
  memberIds: ReadonlyArray<string>;
  removeId: string;
  payerId: string;
}): SplitResult {
  const { amountCents, memberIds, removeId, payerId } = input;

  if (!memberIds.includes(removeId)) {
    return { ok: false, error: 'That person isn’t part of this expense.' };
  }
  if (removeId === payerId) {
    return { ok: false, error: 'You can’t remove the person who paid.' };
  }

  const remaining = memberIds.filter((id) => id !== removeId);
  if (remaining.length < 2) {
    return {
      ok: false,
      error: 'An expense needs at least two people to split between.',
    };
  }

  return splitEqual(amountCents, remaining);
}

/** Dispatch a {@link SplitInput} to the matching split function. */
export function computeSplit(input: SplitInput): SplitResult {
  switch (input.type) {
    case 'equal':
      return splitEqual(input.amountCents, input.userIds);
    case 'exact':
      return splitExact(input.amountCents, input.shares);
    case 'percentage':
      return splitPercentage(input.amountCents, input.weights);
    default: {
      // Exhaustiveness guard — a new SplitType must be handled above.
      const _exhaustive: never = input;
      return { ok: false, error: `Unsupported split type: ${String(_exhaustive)}` };
    }
  }
}

/** The split types this engine supports, for iteration/validation. */
export const SUPPORTED_SPLIT_TYPES: readonly SplitType[] = [
  'equal',
  'exact',
  'percentage',
];
