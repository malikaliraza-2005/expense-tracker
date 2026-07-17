import { cache } from 'react';

import {
  balanceWith,
  computeBalances,
  computeLedger,
  groupBalances,
  groupLedger,
  groupMemberStats,
  overallSummary,
  type BalanceRows,
  type BalanceSummary,
  type CounterpartyBalance,
  type DirectedDebt,
  type MemberStat,
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

/**
 * The ledger rows visible to the caller, shaped for the balance engine. RLS decides
 * the scope: your own rows, plus what 0015/0021 share with you as a participant. Use
 * with {@link balanceWith} to net any two members from one source of truth.
 */
export async function getBalanceRows(): Promise<BalanceRows> {
  const { rows } = await getBalanceContext();
  return rows;
}

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

/** Per-member paid / share / net figures within a single group. */
export async function getGroupMemberStats(
  groupId: string,
): Promise<MemberStat[]> {
  const { me, rows } = await getBalanceContext();
  if (!me) return [];
  return groupMemberStats(groupId, rows);
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

/**
 * A balance the current user has inside *someone else's* ledger — the other side of
 * the single-owner model.
 */
export interface SharedBalance {
  /** The member representing ME in their ledger (the settle target). */
  memberId: string;
  /** The account that owns that ledger. */
  ownerId: string;
  /** That account's display name (their self-member's name). */
  counterpartyName: string;
  /** Net from MY perspective: > 0 they owe me; < 0 I owe them. Never 0. */
  netCents: number;
}

/**
 * The current user's balances inside other people's ledgers.
 *
 * In the single-owner model an expense lives in the ledger of whoever recorded it, and
 * the other participant appears there as a *member* linked to their account (A's "Bob"
 * IS account B). So a user's balance with A isn't in their own ledger at all — it's
 * the net between A's self-member and the member representing them, read from A's
 * rows. 0015 makes those expenses/splits/members readable, and 0021 adds the
 * settlements, so the net derived here is the same figure A sees, just from the other
 * side (hence the inversion: we compute from the representing member's perspective).
 *
 * Deliberately runs the same {@link balanceWith} engine as every other balance — the
 * figure is derived on read from one source of truth, never mirrored or stored, so the
 * two accounts can't disagree.
 */
export const getSharedBalances = cache(async (): Promise<SharedBalance[]> => {
  const user = await getUser();
  if (!user) return [];

  const supabase = createClient();
  const { rows } = await getBalanceContext();

  // Members that represent me in other people's ledgers.
  const { data: reps } = await supabase
    .from('members')
    .select('id, owner_id')
    .eq('linked_user_id', user.id)
    .neq('owner_id', user.id);
  if (!reps || reps.length === 0) return [];

  // Each of those ledgers' self-member — the counterparty on the other side.
  const ownerIds = [...new Set(reps.map((rep) => rep.owner_id))];
  const { data: selves } = await supabase
    .from('members')
    .select('id, owner_id, name')
    .in('owner_id', ownerIds)
    .eq('is_self', true);
  const selfByOwner = new Map((selves ?? []).map((s) => [s.owner_id, s]));

  const balances: SharedBalance[] = [];
  for (const rep of reps) {
    const self = selfByOwner.get(rep.owner_id);
    if (!self) continue;
    // From the representing member's perspective — i.e. mine.
    const netCents = balanceWith(rep.id, self.id, rows);
    if (netCents === 0) continue;
    balances.push({
      memberId: rep.id,
      ownerId: rep.owner_id,
      counterpartyName: self.name,
      netCents,
    });
  }
  return balances.sort((a, b) =>
    a.counterpartyName.localeCompare(b.counterpartyName),
  );
});
