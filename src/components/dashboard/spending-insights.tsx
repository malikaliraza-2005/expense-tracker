'use client';

import { TrendingUp } from 'lucide-react';

import { DonutChart } from '@/components/charts/donut-chart';
import { useCurrency } from '@/components/providers/currency-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { categoryIcon, colorForKey } from '@/constants/categories';
import type { CategorySpend } from '@/types/dto';
import { cn } from '@/utils/cn';

/**
 * Spending insights — an animated donut of spend by category beside a ranked
 * legend of the top categories with their share. Built entirely from data the
 * dashboard already fetched. Hidden by the page when there is no spend.
 */
export function SpendingInsights({
  breakdown,
  monthlySpendCents,
}: {
  breakdown: CategorySpend[];
  monthlySpendCents: number;
}) {
  const { format } = useCurrency();
  const top = breakdown.slice(0, 5);
  const restTotal = breakdown
    .slice(5)
    .reduce((sum, c) => sum + c.totalCents, 0);

  const segments = top.map((c) => ({
    label: c.name,
    value: c.totalCents,
    color: colorForKey(c.icon || c.name),
  }));
  if (restTotal > 0) {
    segments.push({
      label: 'Other',
      value: restTotal,
      color: 'hsl(var(--muted-foreground))',
    });
  }

  const total = breakdown.reduce((sum, c) => sum + c.totalCents, 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" />
          Spending insights
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {format(monthlySpendCents)} this month
        </span>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
          <DonutChart
            segments={segments}
            size={168}
            thickness={16}
            centerValue={format(total)}
            centerLabel="Total spend"
          />
          <ul className="w-full flex-1 space-y-2.5">
            {top.map((c) => {
              const Icon = categoryIcon(c.icon);
              const share = total > 0 ? Math.round((c.totalCents / total) * 100) : 0;
              const color = colorForKey(c.icon || c.name);
              return (
                <li key={c.name} className="flex items-center gap-3">
                  <span
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg [&_svg]:h-4 [&_svg]:w-4"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
                      color,
                    }}
                  >
                    <Icon />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{c.name}</span>
                      <span className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
                        {format(c.totalCents)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                      <div
                        className={cn('h-full rounded-full')}
                        style={{ width: `${share}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
