/**
 * Balance engine (Phase 2).
 *
 * Balances are DERIVED, never stored (see architecture.md §4). This module nets
 * `expense_splits` (who consumed what, and who paid) against `settlements` (real
 * transfers) into a single source of truth for every "who owes whom" figure the
 * app shows.
 *
 * Sign convention, always from the current user (`me`)'s perspective:
 *   netCents > 0  →  the counterparty owes me
 *   netCents < 0  →  I owe the counterparty
 *
 * Pure and side-effect free: it operates on already-fetched, RLS-scoped rows and
 * has no Supabase dependency, so it is unit-verifiable in isolation.
 */
import type { Expense, ExpenseSplit, Settlement } from '@/types/db';

/**
 * Minimal row shapes the engine needs. Declared as `Pick`s of the schema rows so
 * they stay tied to the database types while callers may pass fuller objects.
 */
export interface BalanceRows {
  expenses: ReadonlyArray<Pick<Expense, 'id' | 'group_id' | 'paid_by'>>;
  splits: ReadonlyArray<
    Pick<ExpenseSplit, 'expense_id' | 'user_id' | 'share_cents'>
  >;
  settlements: ReadonlyArray<
    Pick<Settlement, 'group_id' | 'payer_id' | 'receiver_id' | 'amount_cents'>
  >;
}

/** A net balance between the current user and one counterparty. */
export interface CounterpartyBalance {
  userId: string;
  /** > 0 they owe me; < 0 I owe them. Never 0 in list results. */
  netCents: number;
}

/** Aggregate figures for the dashboard header. */
export interface BalanceSummary {
  /** Sum of every positive net — the total others owe me. */
  owedToMeCents: number;
  /** Sum of the magnitudes of every negative net — the total I owe. */
  iOweCents: number;
  /** owedToMeCents − iOweCents. */
  netCents: number;
}

function addTo(map: Map<string, number>, userId: string, delta: number): void {
  map.set(userId, (map.get(userId) ?? 0) + delta);
}

/**
 * Core reduction: my net with every counterparty, keyed by their user id.
 * Includes zero entries; callers that present lists filter those out.
 */
function netByCounterparty(
  me: string,
  rows: BalanceRows,
): Map<string, number> {
  const net = new Map<string, number>();
  const expenseById = new Map(rows.expenses.map((e) => [e.id, e]));

  // Expenses: each split says "user_id consumed share_cents"; the expense's
  // payer fronted it. A share only affects MY balances when I am the payer
  // (someone owes me) or I am the participant (I owe the payer).
  for (const split of rows.splits) {
    const expense = expenseById.get(split.expense_id);
    if (!expense) continue;

    const payer = expense.paid_by;
    if (split.user_id === payer) continue; // payer's own share nets to self

    if (payer === me) {
      addTo(net, split.user_id, split.share_cents); // they owe me
    } else if (split.user_id === me) {
      addTo(net, payer, -split.share_cents); // I owe the payer
    }
    // else: a share between two other people — irrelevant to my balances.
  }

  // Settlements: a real transfer clears debt. Me paying someone moves the
  // balance in my favour; someone paying me moves it against me.
  for (const s of rows.settlements) {
    if (s.payer_id === me) {
      addTo(net, s.receiver_id, s.amount_cents);
    } else if (s.receiver_id === me) {
      addTo(net, s.payer_id, -s.amount_cents);
    }
  }

  return net;
}

function toSortedList(net: Map<string, number>): CounterpartyBalance[] {
  return [...net.entries()]
    .filter(([, netCents]) => netCents !== 0)
    .map(([userId, netCents]) => ({ userId, netCents }))
    .sort((a, b) => a.userId.localeCompare(b.userId));
}

function restrictToGroup(rows: BalanceRows, groupId: string): BalanceRows {
  const expenses = rows.expenses.filter((e) => e.group_id === groupId);
  const ids = new Set(expenses.map((e) => e.id));
  return {
    expenses,
    splits: rows.splits.filter((s) => ids.has(s.expense_id)),
    settlements: rows.settlements.filter((s) => s.group_id === groupId),
  };
}

/**
 * The current user's net balance with a single counterparty, across all scopes.
 * Returns 0 when fully settled (or never transacted).
 */
export function balanceWith(
  me: string,
  other: string,
  rows: BalanceRows,
): number {
  return netByCounterparty(me, rows).get(other) ?? 0;
}

/**
 * The current user's non-zero net balances with every counterparty, across all
 * personal and group activity. Sorted by user id for stable output.
 */
export function computeBalances(
  me: string,
  rows: BalanceRows,
): CounterpartyBalance[] {
  return toSortedList(netByCounterparty(me, rows));
}

/**
 * The current user's non-zero net balances within a single group. Same rows,
 * scoped to one `group_id`.
 */
export function groupBalances(
  me: string,
  groupId: string,
  rows: BalanceRows,
): CounterpartyBalance[] {
  return toSortedList(netByCounterparty(me, restrictToGroup(rows, groupId)));
}

/** Aggregate a list of balances into you-owe / you-are-owed / net totals. */
export function summarize(
  balances: ReadonlyArray<CounterpartyBalance>,
): BalanceSummary {
  let owedToMeCents = 0;
  let iOweCents = 0;
  for (const b of balances) {
    if (b.netCents > 0) owedToMeCents += b.netCents;
    else if (b.netCents < 0) iOweCents += -b.netCents;
  }
  return { owedToMeCents, iOweCents, netCents: owedToMeCents - iOweCents };
}

/** Overall dashboard summary across all of the current user's relationships. */
export function overallSummary(me: string, rows: BalanceRows): BalanceSummary {
  return summarize(computeBalances(me, rows));
}
