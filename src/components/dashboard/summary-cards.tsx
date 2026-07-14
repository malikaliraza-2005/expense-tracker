import { ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react';

import { Money } from '@/components/common/money';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BalanceSummary } from '@/lib/balances';
import { cn } from '@/utils/cn';

/**
 * Dashboard summary cards (presentational, Server-rendered). Three figures from
 * the balance engine's overall summary: the net position, the total owed to the
 * user, and the total the user owes. The net is colored by sign (green when the
 * user is up, red when down, muted when settled).
 */
export function SummaryCards({ summary }: { summary: BalanceSummary }) {
  const { netCents, owedToMeCents, iOweCents } = summary;
  const netTone =
    netCents > 0
      ? 'text-emerald-600 dark:text-emerald-500'
      : netCents < 0
        ? 'text-destructive'
        : 'text-foreground';

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card className="hover:-translate-y-0.5 hover:shadow-elevated">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Net balance
          </CardTitle>
          <Scale className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Money
            cents={netCents}
            className={cn('text-2xl font-semibold', netTone)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {netCents > 0
              ? "You're owed overall"
              : netCents < 0
                ? 'You owe overall'
                : "You're all settled up"}
          </p>
        </CardContent>
      </Card>

      <Card className="hover:-translate-y-0.5 hover:shadow-elevated">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            You are owed
          </CardTitle>
          <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
        </CardHeader>
        <CardContent>
          <Money
            cents={owedToMeCents}
            className="text-2xl font-semibold text-emerald-600 dark:text-emerald-500"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Total others owe you
          </p>
        </CardContent>
      </Card>

      <Card className="hover:-translate-y-0.5 hover:shadow-elevated">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            You owe
          </CardTitle>
          <ArrowUpRight className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <Money
            cents={iOweCents}
            className="text-2xl font-semibold text-destructive"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Total you owe others
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
