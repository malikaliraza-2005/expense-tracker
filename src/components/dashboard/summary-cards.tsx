import { CheckCircle2, Clock, Receipt, Wallet } from 'lucide-react';

import { StatCard } from '@/components/common/stat-card';

/**
 * Dashboard stat tiles — key figures at a glance: spend this month, lifetime
 * expense count, and how many expenses are outstanding vs settled. Each animates
 * its value on entry and glows on hover.
 */
export function SummaryCards({
  monthlySpendCents,
  expenseCount,
  outstandingCount,
  settledCount,
}: {
  monthlySpendCents: number;
  expenseCount: number;
  outstandingCount: number;
  settledCount: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard
        label="This month"
        cents={monthlySpendCents}
        icon={Wallet}
        tone="cyan"
        sublabel="Spend this calendar month"
      />
      <StatCard
        label="Outstanding"
        icon={Clock}
        tone="warning"
        sublabel="Expenses still to settle"
      >
        {outstandingCount}
      </StatCard>
      <StatCard
        label="Settled"
        icon={CheckCircle2}
        tone="income"
        sublabel="Expenses marked settled"
      >
        {settledCount}
      </StatCard>
      <StatCard
        label="Expenses"
        icon={Receipt}
        tone="purple"
        sublabel="Tracked so far"
      >
        {expenseCount}
      </StatCard>
    </div>
  );
}
