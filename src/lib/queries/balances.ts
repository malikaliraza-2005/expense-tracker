import { cache } from 'react';

import {
  computeBalances,
  groupBalances,
  overallSummary,
  balanceWith,
  type BalanceRows,
  type BalanceSummary,
  type CounterpartyBalance,
} from '@/lib/balances';
import { createClient } from '@/lib/supabase/server';

/**
 * Balance reads (Phase 2). The bridge between the RLS-scoped ledger tables and
 * the pure balance engine (lib/balances.ts): these helpers fetch the current
 * user's visible `expenses` / `expense_splits` / `settlements` rows and net them
 * into the figures the UI consumes. Balances are computed on read, never stored.
 *
 * Every read relies on RLS to return only permitted rows — the engine then nets
 * exactly those rows, so a user can only ever see balances they are party to.
 */

interface BalanceContext {
  /** The authenticated user id, or null when unauthenticated. */
  me: string | null;
  rows: BalanceRows;
}

const EMPTY_ROWS: BalanceRows = { expenses: [], splits: [], settlements: [] };

/**
 * Fetch the current user's full, RLS-scoped ledger: every expense, split, and
 * settlement they are permitted to see, shaped for the balance engine. Wrapped
 * in React `cache` so a single request nets from one set of reads.
 */
const getBalanceContext = cache(async (): Promise<BalanceContext> => {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { me: null, rows: EMPTY_ROWS };

  const [expensesRes, splitsRes, settlementsRes] = await Promise.all([
    supabase.from('expenses').select('id, group_id, paid_by'),
    supabase.from('expense_splits').select('expense_id, user_id, share_cents'),
    supabase
      .from('settlements')
      .select('group_id, payer_id, receiver_id, amount_cents'),
  ]);

  return {
    me: user.id,
    rows: {
      expenses: expensesRes.data ?? [],
      splits: splitsRes.data ?? [],
      settlements: settlementsRes.data ?? [],
    },
  };
});

/** The current user's non-zero net balances with every counterparty. */
export async function getBalances(): Promise<CounterpartyBalance[]> {
  const { me, rows } = await getBalanceContext();
  if (!me) return [];
  return computeBalances(me, rows);
}

/** The current user's net balance with one friend (0 when settled). */
export async function getFriendBalance(friendId: string): Promise<number> {
  const { me, rows } = await getBalanceContext();
  if (!me) return 0;
  return balanceWith(me, friendId, rows);
}

/** The current user's non-zero net balances within a single group. */
export async function getGroupBalances(
  groupId: string,
): Promise<CounterpartyBalance[]> {
  const { me, rows } = await getBalanceContext();
  if (!me) return [];
  return groupBalances(me, groupId, rows);
}

/** Overall you-owe / you-are-owed / net totals across all relationships. */
export async function getOverallSummary(): Promise<BalanceSummary> {
  const { me, rows } = await getBalanceContext();
  if (!me) return { owedToMeCents: 0, iOweCents: 0, netCents: 0 };
  return overallSummary(me, rows);
}
