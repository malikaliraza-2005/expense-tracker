import { cache } from 'react';

import {
  balanceWith,
  computeBalances,
  computeLedger,
  groupBalances,
  groupLedger,
  overallSummary,
  type BalanceRows,
  type BalanceSummary,
  type CounterpartyBalance,
  type DirectedDebt,
} from '@/lib/balances';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * Balance reads. The bridge between the owner-scoped ledger tables and the pure
 * balance engine (lib/balances.ts): these helpers fetch the owner's `expenses` /
 * `expense_splits` / `settlements` rows and net them into the figures the UI
 * consumes. Balances are computed on read, never stored.
 *
 * The reference point ("me") is the owner's self-member — `ensure_self_member`
 * returns it (creating it on first call), so the owner can always appear in
 * balances even before adding any members.
 */

interface BalanceContext {
  /** The owner's self-member id, or null when unauthenticated. */
  me: string | null;
  rows: BalanceRows;
}

const EMPTY_ROWS: BalanceRows = { expenses: [], splits: [], settlements: [] };

/**
 * Fetch the owner's full ledger — every expense, split, and settlement — shaped
 * for the balance engine, plus their self-member id. Wrapped in React `cache` so
 * a single request nets from one set of reads.
 */
const getBalanceContext = cache(async (): Promise<BalanceContext> => {
  const user = await getUser();
  if (!user) return { me: null, rows: EMPTY_ROWS };

  const supabase = createClient();
  const [selfRes, expensesRes, splitsRes, settlementsRes] = await Promise.all([
    supabase.rpc('ensure_self_member'),
    supabase.from('expenses').select('id, group_id, paid_by'),
    supabase.from('expense_splits').select('expense_id, member_id, share_cents'),
    supabase
      .from('settlements')
      .select('group_id, payer_id, receiver_id, amount_cents'),
  ]);

  return {
    me: (selfRes.data as string | null) ?? null,
    rows: {
      expenses: expensesRes.data ?? [],
      splits: splitsRes.data ?? [],
      settlements: settlementsRes.data ?? [],
    },
  };
});

/** The owner's non-zero net balances with every member. */
export async function getBalances(): Promise<CounterpartyBalance[]> {
  const { me, rows } = await getBalanceContext();
  if (!me) return [];
  return computeBalances(me, rows);
}

/** The owner's net balance with one member (0 when settled). */
export async function getMemberBalance(memberId: string): Promise<number> {
  const { me, rows } = await getBalanceContext();
  if (!me) return 0;
  return balanceWith(me, memberId, rows);
}

/** The owner's non-zero net balances within a single group. */
export async function getGroupBalances(
  groupId: string,
): Promise<CounterpartyBalance[]> {
  const { me, rows } = await getBalanceContext();
  if (!me) return [];
  return groupBalances(me, groupId, rows);
}

/** The full who-owes-whom ledger within a single group (every pair). */
export async function getGroupLedgerDebts(
  groupId: string,
): Promise<DirectedDebt[]> {
  const { me, rows } = await getBalanceContext();
  if (!me) return [];
  return groupLedger(groupId, rows);
}

/** The full who-owes-whom ledger across all of the owner's activity. */
export async function getLedgerDebts(): Promise<DirectedDebt[]> {
  const { me, rows } = await getBalanceContext();
  if (!me) return [];
  return computeLedger(rows);
}

/** Overall you-owe / you-are-owed / net totals across all members. */
export async function getOverallSummary(): Promise<BalanceSummary> {
  const { me, rows } = await getBalanceContext();
  if (!me) return { owedToMeCents: 0, iOweCents: 0, netCents: 0 };
  return overallSummary(me, rows);
}

/** The owner's self-member id (creating it on first call), or null. */
export async function getSelfMemberId(): Promise<string | null> {
  const { me } = await getBalanceContext();
  return me;
}
