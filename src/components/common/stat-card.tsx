import * as React from 'react';

import type { LucideIcon } from 'lucide-react';

import { AnimatedNumber } from '@/components/motion/animated-number';
import { Card } from '@/components/ui/card';
import { cn } from '@/utils/cn';

type Tone = 'neon' | 'income' | 'expense' | 'purple' | 'cyan' | 'warning';

const TONE: Record<Tone, { text: string; tile: string; glow: string }> = {
  neon: {
    text: 'text-primary',
    tile: 'bg-primary/15 text-primary ring-primary/25',
    glow: 'group-hover:shadow-[0_0_40px_-8px_hsl(var(--primary)/0.5)]',
  },
  income: {
    text: 'text-income',
    tile: 'bg-income/15 text-income ring-income/25',
    glow: 'group-hover:shadow-[0_0_40px_-8px_hsl(var(--income)/0.5)]',
  },
  expense: {
    text: 'text-expense',
    tile: 'bg-expense/15 text-expense ring-expense/25',
    glow: 'group-hover:shadow-[0_0_40px_-8px_hsl(var(--expense)/0.5)]',
  },
  purple: {
    text: 'text-purple',
    tile: 'bg-purple/15 text-purple ring-purple/25',
    glow: 'group-hover:shadow-[0_0_40px_-8px_hsl(var(--purple)/0.5)]',
  },
  cyan: {
    text: 'text-cyan',
    tile: 'bg-cyan/15 text-cyan ring-cyan/25',
    glow: 'group-hover:shadow-[0_0_40px_-8px_hsl(var(--cyan)/0.5)]',
  },
  warning: {
    text: 'text-warning',
    tile: 'bg-warning/15 text-warning ring-warning/25',
    glow: 'group-hover:shadow-[0_0_40px_-8px_hsl(var(--warning)/0.5)]',
  },
};

/**
 * A premium metric tile: a tinted icon, a label, and a large animated figure.
 * `cents` renders a currency count-up; pass `children` for a custom value. Tone
 * drives the neon accent (blue/emerald/red/purple/cyan/amber).
 */
export function StatCard({
  label,
  cents,
  icon: Icon,
  tone = 'neon',
  sublabel,
  children,
  className,
}: {
  label: string;
  cents?: number;
  icon: LucideIcon;
  tone?: Tone;
  sublabel?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <Card
      className={cn(
        'group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-1',
        t.glow,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span
          className={cn(
            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-transform duration-300 group-hover:scale-110 [&_svg]:h-4.5 [&_svg]:w-4.5',
            t.tile,
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <div className={cn('mt-3 text-2xl font-semibold tabular-nums sm:text-3xl', t.text)}>
        {typeof cents === 'number' ? (
          <AnimatedNumber value={cents} currency />
        ) : (
          children
        )}
      </div>
      {sublabel ? (
        <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>
      ) : null}
    </Card>
  );
}
