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

/** Per-member aggregate within a scope: what they paid, their share, and net. */
export interface MemberStat {
  memberId: string;
  /** Total value of expenses this member fronted (paid for). */
  paidCents: number;
  /** This member's total share across the scope's expenses. */
  owesCents: number;
  /**
   * Settlement-aware net: paidCents − owesCents, plus settlements they paid,
   * minus settlements they received. > 0 they are owed; < 0 they owe.
   */
  netCents: number;
}

/**
 * Per-member figures for ONE expense: what they fronted, what they owe, and what
 * is still outstanding on this expense. Unlike {@link MemberStat} these are
 * single-expense facts, not a cross-scope net.
 */
export interface ExpenseMemberFigure {
  memberId: string;
  /** Amount this member fronted for the expense — the full total if the payer. */
  paidCents: number;
  /** This member's equal share of the expense. */
  owedCents: number;
  /**
   * Still-outstanding amount on this expense: 0 once the expense is settled;
   * otherwise the payer is owed back everyone else's shares, and each other
   * participant still owes their own share.
   */
  remainingCents: number;
}

/** Inputs for {@link expenseMemberLedger}: one expense's total, payer, and splits. */
export interface ExpenseLedgerInput {
  amountCents: number;
  payerId: string;
  splits: ReadonlyArray<{ memberId: string; shareCents: number }>;
  /** The expense's manual settled flag (migration 0011). Zeroes remaining. */
  settled: boolean;
}

/**
 * Per-participant paid / owed / remaining for a single expense, in split order.
 *
 * Single-payer, equal-split model: the payer fronts the whole total (`paidCents`
 * = amount) while everyone else fronts nothing; each participant owes their
 * `shareCents`. Outstanding follows the expense's own settled flag — nil when
 * settled, otherwise the payer is still owed the sum of the other shares
 * (`amount − own share`) and each other participant still owes their share. The
 * payer's remaining therefore equals the sum of the others', by construction.
 */
export function expenseMemberLedger(
  input: ExpenseLedgerInput,
): ExpenseMemberFigure[] {
  return input.splits.map(({ memberId, shareCents }) => {
    const isPayer = memberId === input.payerId;
    const paidCents = isPayer ? input.amountCents : 0;
    const remainingCents = input.settled
      ? 0
      : isPayer
        ? input.amountCents - shareCents
        : shareCents;
    return { memberId, paidCents, owedCents: shareCents, remainingCents };
  });
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

/**
 * Per-member paid / share / net within a single group. `paidCents` is the full
 * value of expenses the member fronted; `owesCents` is their total share; and
 * `netCents` is the settlement-aware net (paid − share, plus settlements paid,
 * minus settlements received) — the figure that clears when they settle up.
 * Every member appearing in the group's expenses or settlements is included,
 * even when square, so the Members page can list a zero balance. Sorted by id.
 */
export function groupMemberStats(
  groupId: string,
  rows: BalanceRows,
): MemberStat[] {
  const scoped = restrictToGroup(rows, groupId);
  const expenseById = new Map(scoped.expenses.map((e) => [e.id, e]));

  const paid = new Map<string, number>();
  const share = new Map<string, number>();
  const settled = new Map<string, number>(); // +what they paid, −what they got

  for (const split of scoped.splits) {
    const expense = expenseById.get(split.expense_id);
    if (!expense) continue;
    addTo(share, split.member_id, split.share_cents); // their consumption
    addTo(paid, expense.paid_by, split.share_cents); // the payer fronted it
  }
  for (const s of scoped.settlements) {
    addTo(settled, s.payer_id, s.amount_cents);
    addTo(settled, s.receiver_id, -s.amount_cents);
  }

  const ids = new Set<string>([
    ...paid.keys(),
    ...share.keys(),
    ...settled.keys(),
  ]);
  return [...ids]
    .map((memberId) => {
      const paidCents = paid.get(memberId) ?? 0;
      const owesCents = share.get(memberId) ?? 0;
      const netCents = paidCents - owesCents + (settled.get(memberId) ?? 0);
      return { memberId, paidCents, owesCents, netCents };
    })
    .sort((a, b) => a.memberId.localeCompare(b.memberId));
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
