'use client';

import Link from 'next/link';

import { CheckCircle2, Clock, Plus, Wallet } from 'lucide-react';

import { DonutChart } from '@/components/charts/donut-chart';
import { AnimatedNumber } from '@/components/motion/animated-number';
import { useCurrency } from '@/components/providers/currency-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/utils/cn';

/**
 * Dashboard centrepiece: a glass panel summarising outstanding vs settled
 * spend. The outstanding total animates in as a large figure, flanked by a
 * donut splitting outstanding against settled. Quick actions sit below.
 */
export function OutstandingHero({
  outstandingCents,
  settledCents,
  outstandingCount,
  settledCount,
}: {
  outstandingCents: number;
  settledCents: number;
  outstandingCount: number;
  settledCount: number;
}) {
  const allSettled = outstandingCents === 0 && settledCents > 0;
  const nothing = outstandingCents === 0 && settledCents === 0;

  return (
    <Card className="relative overflow-hidden p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />

      <div className="relative flex flex-col items-center gap-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-sm">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Wallet className="h-3.5 w-3.5 text-primary" />
            Outstanding balance
          </div>

          <div
            className={cn(
              'mt-3 text-4xl font-bold tracking-tight tabular-nums sm:text-5xl',
              allSettled ? 'text-income' : 'text-foreground',
            )}
          >
            <AnimatedNumber value={outstandingCents} currency />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {nothing
              ? 'Add an expense to start tracking what needs settling.'
              : allSettled
                ? 'All settled up — nothing outstanding right now. 🎉'
                : `${outstandingCount} expense${outstandingCount === 1 ? '' : 's'} still to settle.`}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <MiniStat
              icon={<Clock className="h-4 w-4" />}
              label="Outstanding"
              value={outstandingCents}
              tone="warning"
            />
            <MiniStat
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Settled"
              value={settledCents}
              tone="income"
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild variant="gradient">
              <Link href={ROUTES.newExpense}>
                <Plus />
                Add expense
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={ROUTES.expenses}>View activity</Link>
            </Button>
          </div>
        </div>

        <div className="shrink-0">
          <DonutChart
            size={196}
            thickness={20}
            segments={[
              {
                label: 'Outstanding',
                value: outstandingCents,
                color: 'hsl(var(--warning))',
              },
              {
                label: 'Settled',
                value: settledCents,
                color: 'hsl(var(--income))',
              },
            ]}
            centerLabel={
              nothing ? 'No expenses' : allSettled ? 'All settled' : 'To settle'
            }
            centerValue={
              <span className={allSettled ? 'text-income' : 'text-foreground'}>
                {settledCount + outstandingCount}
              </span>
            }
          />
        </div>
      </div>
    </Card>
  );
}

function MiniStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'warning' | 'income';
}) {
  const { format } = useCurrency();
  const color = tone === 'warning' ? 'text-warning' : 'text-income';
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <div className={cn('flex items-center gap-1.5 text-xs font-medium', color)}>
        {icon}
        {label}
      </div>
      <p className={cn('mt-1 text-lg font-semibold tabular-nums', color)}>
        {format(value)}
      </p>
    </div>
  );
}
