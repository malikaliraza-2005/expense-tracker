import type { Metadata } from 'next';

import {
  balanceWith,
  computeBalances,
  groupBalances,
  overallSummary,
  type BalanceRows,
} from '@/lib/balances';
import {
  splitEqual,
  splitExact,
  splitPercentage,
  sumShares,
  type SplitResult,
} from '@/lib/splits';
import { formatCents } from '@/utils/money';

export const metadata: Metadata = {
  title: 'Dev — Balance & Split Verification',
  robots: { index: false, follow: false },
};

/**
 * TEMPORARY internal verification page (Phase 2).
 *
 * Runs the pure split and balance engines against fixed seed scenarios and
 * renders a pass/fail table, satisfying the Phase 2 acceptance gate ("all three
 * split types sum exactly to total; balances reconcile") without a test runner.
 * No database access — it exercises the math in isolation.
 *
 * Remove this route once automated coverage lands (see phase-2 doc §4, §6).
 */

interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

// ── Split scenarios ────────────────────────────────────────────────────────
const [A, B, C] = ['user-a', 'user-b', 'user-c'];

function sharesDetail(result: SplitResult): string {
  if (!result.ok) return `error: ${result.error}`;
  const parts = result.shares.map((s) => s.shareCents).join(' + ');
  return `${parts} = ${sumShares(result.shares)}`;
}

function buildSplitChecks(): Check[] {
  const checks: Check[] = [];

  // 1. Equal split with an indivisible total distributes the remainder.
  const equalOdd = splitEqual(100, [A, B, C]);
  checks.push({
    name: 'Equal 100 / 3 sums to total',
    pass:
      equalOdd.ok &&
      sumShares(equalOdd.shares) === 100 &&
      equalOdd.shares.map((s) => s.shareCents).join(',') === '34,33,33',
    detail: sharesDetail(equalOdd),
  });

  // 2. Single-participant expense → that participant owes the whole total.
  const single = splitEqual(5000, [A]);
  checks.push({
    name: 'Equal single participant gets full total',
    pass: single.ok && single.shares[0]?.shareCents === 5000,
    detail: sharesDetail(single),
  });

  // 3. Exact split whose shares sum to the total is accepted.
  const exactOk = splitExact(1000, [
    { userId: A, shareCents: 600 },
    { userId: B, shareCents: 400 },
  ]);
  checks.push({
    name: 'Exact split summing to total is accepted',
    pass: exactOk.ok && sumShares(exactOk.shares) === 1000,
    detail: sharesDetail(exactOk),
  });

  // 4. Exact split whose shares do NOT sum to the total is rejected.
  const exactBad = splitExact(1000, [
    { userId: A, shareCents: 600 },
    { userId: B, shareCents: 300 },
  ]);
  checks.push({
    name: 'Exact split not summing to total is rejected',
    pass: !exactBad.ok,
    detail: sharesDetail(exactBad),
  });

  // 5. Percentage split summing to 100 yields cents that sum exactly to total.
  const pct = splitPercentage(1000, [
    { userId: A, percent: 33.33 },
    { userId: B, percent: 33.33 },
    { userId: C, percent: 33.34 },
  ]);
  checks.push({
    name: 'Percentage 33.33/33.33/33.34 of 1000 sums to total',
    pass: pct.ok && sumShares(pct.shares) === 1000,
    detail: sharesDetail(pct),
  });

  // 6. Percentages that do not sum to 100 are rejected.
  const pctBad = splitPercentage(1000, [
    { userId: A, percent: 50 },
    { userId: B, percent: 40 },
  ]);
  checks.push({
    name: 'Percentages not summing to 100 are rejected',
    pass: !pctBad.ok,
    detail: sharesDetail(pctBad),
  });

  return checks;
}

// ── Balance scenario ───────────────────────────────────────────────────────
// Perspective: ME = A. Participants B and C. One group G1.
const ME = A;
const G1 = 'group-1';

const SEED: BalanceRows = {
  expenses: [
    // E1: A paid 3000, personal, split equally A/B/C (1000 each).
    { id: 'e1', group_id: null, paid_by: A },
    // E2: B paid 900, personal, split equally A/B/C (300 each).
    { id: 'e2', group_id: null, paid_by: B },
    // E3: A paid 1000 in group G1, split A/B (500 each).
    { id: 'e3', group_id: G1, paid_by: A },
  ],
  splits: [
    { expense_id: 'e1', user_id: A, share_cents: 1000 },
    { expense_id: 'e1', user_id: B, share_cents: 1000 },
    { expense_id: 'e1', user_id: C, share_cents: 1000 },
    { expense_id: 'e2', user_id: A, share_cents: 300 },
    { expense_id: 'e2', user_id: B, share_cents: 300 },
    { expense_id: 'e2', user_id: C, share_cents: 300 },
    { expense_id: 'e3', user_id: A, share_cents: 500 },
    { expense_id: 'e3', user_id: B, share_cents: 500 },
  ],
  // S1: B pays A back 700 (personal), settling their net exactly.
  settlements: [
    { group_id: null, payer_id: B, receiver_id: A, amount_cents: 700 },
  ],
};

function buildBalanceChecks(): Check[] {
  const checks: Check[] = [];

  // Hand-computed expectations from A's perspective:
  //   E1 → B owes 1000, C owes 1000
  //   E2 → A owes B 300              → net B = +700, net C = +1000
  //   E3 (G1) → B owes 500           → net B = +1200, net C = +1000
  //   S1 → B paid A 700              → net B = +500,  net C = +1000
  const withB = balanceWith(ME, B, SEED);
  checks.push({
    name: 'Net with B nets to +500 across expenses & settlement',
    pass: withB === 500,
    detail: `balanceWith(A, B) = ${withB} (${formatCents(withB)})`,
  });

  const withC = balanceWith(ME, C, SEED);
  checks.push({
    name: 'Net with C is +1000 (owes me)',
    pass: withC === 1000,
    detail: `balanceWith(A, C) = ${withC} (${formatCents(withC)})`,
  });

  // A settlement reduces exactly its amount: without S1, net with B is +1200.
  const withoutSettlement = balanceWith(ME, B, {
    ...SEED,
    settlements: [],
  });
  checks.push({
    name: 'Settlement of 700 reduces B balance by exactly 700',
    pass: withoutSettlement === 1200 && withoutSettlement - withB === 700,
    detail: `before = ${withoutSettlement}, after = ${withB}, delta = ${withoutSettlement - withB}`,
  });

  // Group-scoped balances: only E3 counts inside G1 → B owes 500.
  const gb = groupBalances(ME, G1, SEED);
  checks.push({
    name: 'Group G1 balance is B → +500 only',
    pass:
      gb.length === 1 && gb[0]?.userId === B && gb[0]?.netCents === 500,
    detail: gb.map((b) => `${b.userId}:${b.netCents}`).join(', ') || '(none)',
  });

  // Overall summary: owed to me = 500 (B) + 1000 (C) = 1500; I owe = 0.
  const summary = overallSummary(ME, SEED);
  checks.push({
    name: 'Overall summary owed=1500, owe=0, net=1500',
    pass:
      summary.owedToMeCents === 1500 &&
      summary.iOweCents === 0 &&
      summary.netCents === 1500,
    detail: `owed=${summary.owedToMeCents}, owe=${summary.iOweCents}, net=${summary.netCents}`,
  });

  // Fully-settled relationship nets to zero (and drops out of the list).
  const settled: BalanceRows = {
    expenses: [{ id: 'x1', group_id: null, paid_by: A }],
    splits: [
      { expense_id: 'x1', user_id: A, share_cents: 500 },
      { expense_id: 'x1', user_id: B, share_cents: 500 },
    ],
    settlements: [
      { group_id: null, payer_id: B, receiver_id: A, amount_cents: 500 },
    ],
  };
  const settledBalances = computeBalances(ME, settled);
  checks.push({
    name: 'Fully settled → zero balance, excluded from list',
    pass:
      balanceWith(ME, B, settled) === 0 && settledBalances.length === 0,
    detail: `balanceWith = ${balanceWith(ME, B, settled)}, list length = ${settledBalances.length}`,
  });

  return checks;
}

function CheckTable({ title, checks }: { title: string; checks: Check[] }) {
  const passed = checks.filter((c) => c.pass).length;
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <span
          className={
            passed === checks.length
              ? 'text-sm font-medium text-green-600'
              : 'text-sm font-medium text-red-600'
          }
        >
          {passed}/{checks.length} passing
        </span>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Check</th>
              <th className="px-3 py-2 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.name} className="border-t">
                <td className="px-3 py-2">
                  <span className={c.pass ? 'text-green-600' : 'text-red-600'}>
                    {c.pass ? 'PASS' : 'FAIL'}
                  </span>
                </td>
                <td className="px-3 py-2">{c.name}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {c.detail}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function DevBalancesPage() {
  const splitChecks = buildSplitChecks();
  const balanceChecks = buildBalanceChecks();
  const allPass = [...splitChecks, ...balanceChecks].every((c) => c.pass);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Phase 2 — Engine Verification
        </h1>
        <p className="text-sm text-muted-foreground">
          Temporary dev page. Exercises the split &amp; balance engines against
          fixed seed scenarios.{' '}
          <span className={allPass ? 'text-green-600' : 'text-red-600'}>
            {allPass ? 'All checks passing.' : 'Some checks failing.'}
          </span>
        </p>
      </header>
      <CheckTable title="Split engine" checks={splitChecks} />
      <CheckTable title="Balance engine" checks={balanceChecks} />
    </div>
  );
}
