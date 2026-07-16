import { describe, expect, it } from 'vitest';

import {
  balanceWith,
  computeBalances,
  computeLedger,
  expenseMemberLedger,
  groupBalances,
  groupMemberStats,
  overallSummary,
  summarize,
  type BalanceRows,
} from '@/lib/balances';

/**
 * Fixture: owner "me" plus members "a" and "b".
 *  e1 — me paid 900, split equally me/a/b (300 each) → a & b each owe me 300.
 *  e2 — a paid 300, split me/a (150 each)            → me owes a 150.
 *  s1 — a paid me 150 (settlement)                   → clears a↔me.
 * Net after all: a↔me square; b owes me 300.
 */
const rows: BalanceRows = {
  expenses: [
    { id: 'e1', group_id: null, paid_by: 'me' },
    { id: 'e2', group_id: null, paid_by: 'a' },
  ],
  splits: [
    { expense_id: 'e1', member_id: 'me', share_cents: 300 },
    { expense_id: 'e1', member_id: 'a', share_cents: 300 },
    { expense_id: 'e1', member_id: 'b', share_cents: 300 },
    { expense_id: 'e2', member_id: 'me', share_cents: 150 },
    { expense_id: 'e2', member_id: 'a', share_cents: 150 },
  ],
  settlements: [
    { group_id: null, payer_id: 'a', receiver_id: 'me', amount_cents: 150 },
  ],
};

describe('computeBalances (owner-centric)', () => {
  it('nets expenses and settlements from the owner perspective', () => {
    const balances = computeBalances('me', rows);
    // a is square (dropped as zero); b owes me 300.
    expect(balances).toEqual([{ memberId: 'b', netCents: 300 }]);
  });

  it('omits fully-settled counterparties', () => {
    expect(computeBalances('me', rows).some((b) => b.memberId === 'a')).toBe(false);
  });

  it('is symmetric for a single expense before settlement', () => {
    const onlyE1: BalanceRows = { ...rows, expenses: [rows.expenses[0]], splits: rows.splits.slice(0, 3), settlements: [] };
    expect(balanceWith('me', 'a', onlyE1)).toBe(300); // a owes me
    expect(balanceWith('a', 'me', onlyE1)).toBe(-300); // I(a) owe me
  });
});

describe('summarize / overallSummary', () => {
  it('splits nets into owed-to-me / i-owe / net', () => {
    expect(summarize([
      { memberId: 'a', netCents: 300 },
      { memberId: 'b', netCents: -120 },
    ])).toEqual({ owedToMeCents: 300, iOweCents: 120, netCents: 180 });
  });

  it('overallSummary aggregates the owner-centric balances', () => {
    expect(overallSummary('me', rows)).toEqual({
      owedToMeCents: 300,
      iOweCents: 0,
      netCents: 300,
    });
  });
});

describe('computeLedger (pairwise, all members)', () => {
  it('collapses each pair to a single directed debt', () => {
    // a↔me square after the settlement; b still owes me 300.
    expect(computeLedger(rows)).toEqual([
      { fromId: 'b', toId: 'me', amountCents: 300 },
    ]);
  });

  it('surfaces a debt between two non-owner members', () => {
    const r: BalanceRows = {
      expenses: [{ id: 'x', group_id: null, paid_by: 'a' }],
      splits: [
        { expense_id: 'x', member_id: 'a', share_cents: 500 },
        { expense_id: 'x', member_id: 'b', share_cents: 500 },
      ],
      settlements: [],
    };
    expect(computeLedger(r)).toEqual([
      { fromId: 'b', toId: 'a', amountCents: 500 },
    ]);
  });
});

describe('group scoping', () => {
  const grouped: BalanceRows = {
    expenses: [{ id: 'g-e', group_id: 'g1', paid_by: 'a' }],
    splits: [
      { expense_id: 'g-e', member_id: 'me', share_cents: 100 },
      { expense_id: 'g-e', member_id: 'a', share_cents: 100 },
    ],
    settlements: [],
  };

  it('groupBalances scopes to one group', () => {
    expect(groupBalances('me', 'g1', grouped)).toEqual([
      { memberId: 'a', netCents: -100 }, // me owes a 100
    ]);
    expect(groupBalances('me', 'other', grouped)).toEqual([]);
  });

  it('groupMemberStats reports paid / owes / net per member', () => {
    const stats = groupMemberStats('g1', grouped);
    expect(stats).toEqual([
      { memberId: 'a', paidCents: 200, owesCents: 100, netCents: 100 },
      { memberId: 'me', paidCents: 0, owesCents: 100, netCents: -100 },
    ]);
  });
});

describe('expenseMemberLedger (per-expense paid / owed / remaining)', () => {
  // 90 paid by me, split equally me/a/b (30 each).
  const splits = [
    { memberId: 'me', shareCents: 30 },
    { memberId: 'a', shareCents: 30 },
    { memberId: 'b', shareCents: 30 },
  ];

  it('gives the payer the full paid amount and owes them the others’ shares', () => {
    const ledger = expenseMemberLedger({
      amountCents: 90,
      payerId: 'me',
      splits,
      settled: false,
    });
    expect(ledger).toEqual([
      { memberId: 'me', paidCents: 90, owedCents: 30, remainingCents: 60 },
      { memberId: 'a', paidCents: 0, owedCents: 30, remainingCents: 30 },
      { memberId: 'b', paidCents: 0, owedCents: 30, remainingCents: 30 },
    ]);
  });

  it('the payer’s remaining equals the sum of the other participants’', () => {
    const ledger = expenseMemberLedger({
      amountCents: 90,
      payerId: 'me',
      splits,
      settled: false,
    });
    const payer = ledger.find((f) => f.memberId === 'me')!;
    const others = ledger
      .filter((f) => f.memberId !== 'me')
      .reduce((sum, f) => sum + f.remainingCents, 0);
    expect(payer.remainingCents).toBe(others);
  });

  it('zeroes every remaining once the expense is settled', () => {
    const ledger = expenseMemberLedger({
      amountCents: 90,
      payerId: 'me',
      splits,
      settled: true,
    });
    expect(ledger.every((f) => f.remainingCents === 0)).toBe(true);
    // Paid and owed still reflect the historical split.
    expect(ledger[0]).toEqual({
      memberId: 'me',
      paidCents: 90,
      owedCents: 30,
      remainingCents: 0,
    });
  });

  it('handles an uneven split, preserving the recorded shares', () => {
    // 100 / 3 → 34, 33, 33 (payer a).
    const ledger = expenseMemberLedger({
      amountCents: 100,
      payerId: 'a',
      splits: [
        { memberId: 'a', shareCents: 34 },
        { memberId: 'b', shareCents: 33 },
        { memberId: 'c', shareCents: 33 },
      ],
      settled: false,
    });
    expect(ledger).toEqual([
      { memberId: 'a', paidCents: 100, owedCents: 34, remainingCents: 66 },
      { memberId: 'b', paidCents: 0, owedCents: 33, remainingCents: 33 },
      { memberId: 'c', paidCents: 0, owedCents: 33, remainingCents: 33 },
    ]);
  });

  it('treats a payer who is not a participant as absent from the ledger', () => {
    // Payer `x` fronted the money but does not share; only a & b owe.
    const ledger = expenseMemberLedger({
      amountCents: 80,
      payerId: 'x',
      splits: [
        { memberId: 'a', shareCents: 40 },
        { memberId: 'b', shareCents: 40 },
      ],
      settled: false,
    });
    expect(ledger).toEqual([
      { memberId: 'a', paidCents: 0, owedCents: 40, remainingCents: 40 },
      { memberId: 'b', paidCents: 0, owedCents: 40, remainingCents: 40 },
    ]);
  });
});
