/**
 * Balance engine.
 *
 * Balances are DERIVED, never stored. This module nets `expense_splits` (who
 * consumed what, and who paid) against `settlements` (real transfers) into a
 * single source of truth for every "who owes whom" figure the app shows.
 *
 * Since migration 0010 every party is a `Member`. Two views are derived from the
 * same rows:
 *   - Owner-centric: each member's net vs the owner's self-member. Sign, always
 *     from the self member's perspective: netCents > 0 they owe me; < 0 I owe them.
 *   - Pairwise ledger: the directed debt between EVERY pair of members, so a
 *     group's balances show "Ali → Ahmed" even when the owner isn't involved.
 *
 * Pure and side-effect free: it operates on already-fetched, owner-scoped rows
 * and has no Supabase dependency, so it is unit-verifiable in isolation.
 */
import type { Expense, ExpenseSplit, Settlement } from '@/types/db';

/**
 * Minimal row shapes the engine needs. Declared as `Pick`s of the schema rows so
 * they stay tied to the database types while callers may pass fuller objects.
 */
export interface BalanceRows {
  expenses: ReadonlyArray<Pick<Expense, 'id' | 'group_id' | 'paid_by'>>;
  splits: ReadonlyArray<
    Pick<ExpenseSplit, 'expense_id' | 'member_id' | 'share_cents'>
  >;
  settlements: ReadonlyArray<
    Pick<Settlement, 'group_id' | 'payer_id' | 'receiver_id' | 'amount_cents'>
  >;
}

/** A net balance between the reference member and one counterparty. */
export interface CounterpartyBalance {
  memberId: string;
  /** > 0 they owe me; < 0 I owe them. Never 0 in list results. */
  netCents: number;
}

/** One directed debt: `fromId` owes `toId` `amountCents` (always > 0). */
export interface DirectedDebt {
  fromId: string;
  toId: string;
  amountCents: number;
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

function addTo(map: Map<string, number>, memberId: string, delta: number): void {
  map.set(memberId, (map.get(memberId) ?? 0) + delta);
}

/**
 * Core reduction: the reference member's net with every counterparty, keyed by
 * the counterparty's member id. Includes zero entries; list callers filter them.
 */
function netByCounterparty(
  me: string,
  rows: BalanceRows,
): Map<string, number> {
  const net = new Map<string, number>();
  const expenseById = new Map(rows.expenses.map((e) => [e.id, e]));

  // Expenses: each split says "member_id consumed share_cents"; the payer
  // fronted it. A share only affects MY balances when I am the payer (they owe
  // me) or I am the participant (I owe the payer).
  for (const split of rows.splits) {
    const expense = expenseById.get(split.expense_id);
    if (!expense) continue;

    const payer = expense.paid_by;
    if (split.member_id === payer) continue; // payer's own share nets to self

    if (payer === me) {
      addTo(net, split.member_id, split.share_cents); // they owe me
    } else if (split.member_id === me) {
      addTo(net, payer, -split.share_cents); // I owe the payer
    }
    // else: a share between two other members — handled by the pairwise ledger.
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
    .map(([memberId, netCents]) => ({ memberId, netCents }))
    .sort((a, b) => a.memberId.localeCompare(b.memberId));
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
 * The reference member's net balance with a single counterparty, across all
 * scopes. Returns 0 when fully settled (or never transacted).
 */
export function balanceWith(
  me: string,
  other: string,
  rows: BalanceRows,
): number {
  return netByCounterparty(me, rows).get(other) ?? 0;
}

/**
 * The reference member's non-zero net balances with every counterparty, across
 * all activity. Sorted by member id for stable output.
 */
export function computeBalances(
  me: string,
  rows: BalanceRows,
): CounterpartyBalance[] {
  return toSortedList(netByCounterparty(me, rows));
}

/**
 * The reference member's non-zero net balances within a single group. Same rows,
 * scoped to one `group_id`.
 */
export function groupBalances(
  me: string,
  groupId: string,
  rows: BalanceRows,
): CounterpartyBalance[] {
  return toSortedList(netByCounterparty(me, restrictToGroup(rows, groupId)));
}

/**
 * The full who-owes-whom ledger among ALL members in `rows`: for every pair, the
 * single net directed debt (nothing when they're square). This surfaces debts
 * between two non-owner members that the owner-centric view omits.
 *
 * Sorted by amount (largest first) then id for stable, useful output.
 */
export function computeLedger(rows: BalanceRows): DirectedDebt[] {
  // owes[a][b] = net cents member `a` owes member `b` (may be negative).
  const owes = new Map<string, Map<string, number>>();
  const bump = (from: string, to: string, delta: number) => {
    if (from === to || delta === 0) return;
    let row = owes.get(from);
    if (!row) {
      row = new Map();
      owes.set(from, row);
    }
    row.set(to, (row.get(to) ?? 0) + delta);
  };

  const expenseById = new Map(rows.expenses.map((e) => [e.id, e]));
  for (const split of rows.splits) {
    const expense = expenseById.get(split.expense_id);
    if (!expense) continue;
    // The participant owes the payer their share.
    bump(split.member_id, expense.paid_by, split.share_cents);
  }
  for (const s of rows.settlements) {
    // Paying someone reduces what you owe them.
    bump(s.payer_id, s.receiver_id, -s.amount_cents);
  }

  // Collapse each unordered pair to one directed debt: net = owes(a,b) − owes(b,a).
  const seen = new Set<string>();
  const debts: DirectedDebt[] = [];
  for (const [a, row] of owes) {
    for (const b of row.keys()) {
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const net = (owes.get(a)?.get(b) ?? 0) - (owes.get(b)?.get(a) ?? 0);
      if (net > 0) debts.push({ fromId: a, toId: b, amountCents: net });
      else if (net < 0) debts.push({ fromId: b, toId: a, amountCents: -net });
    }
  }

  return debts.sort(
    (x, y) =>
      y.amountCents - x.amountCents ||
      x.fromId.localeCompare(y.fromId) ||
      x.toId.localeCompare(y.toId),
  );
}

/** The full pairwise ledger restricted to a single group. */
export function groupLedger(groupId: string, rows: BalanceRows): DirectedDebt[] {
  return computeLedger(restrictToGroup(rows, groupId));
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

/** Overall dashboard summary across all of the owner's members. */
export function overallSummary(me: string, rows: BalanceRows): BalanceSummary {
  return summarize(computeBalances(me, rows));
}
