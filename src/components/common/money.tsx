import * as React from 'react';

import { formatCents } from '@/utils/money';
import { cn } from '@/utils/cn';

/**
 * Money & balance display primitives. `formatCents` (utils/money.ts) is the only
 * sanctioned cents→string bridge; these components wrap it so amounts and
 * directional balances render consistently everywhere.
 */

export interface MoneyProps extends React.HTMLAttributes<HTMLSpanElement> {
  cents: number;
}

/** A plain formatted currency amount, e.g. 1234 → "$12.34". */
export function Money({ cents, className, ...props }: MoneyProps) {
  return (
    <span className={cn('tabular-nums', className)} {...props}>
      {formatCents(cents)}
    </span>
  );
}

export interface BalanceLabelProps {
  /** Net from the current user's perspective: > 0 owed to me, < 0 I owe. */
  netCents: number;
  /** Whose viewpoint the sentence takes. `them` reads "owes you / you owe". */
  subject?: 'you' | 'them';
  className?: string;
}

/**
 * A colored, directional balance sentence. Positive = owed to the user (green),
 * negative = the user owes (red/destructive), zero = settled (muted).
 */
export function BalanceLabel({
  netCents,
  subject = 'you',
  className,
}: BalanceLabelProps) {
  if (netCents === 0) {
    return (
      <span className={cn('text-sm text-muted-foreground', className)}>
        Settled up
      </span>
    );
  }

  const owedToUser = netCents > 0;
  const amount = formatCents(Math.abs(netCents));
  const text = owedToUser
    ? subject === 'them'
      ? `owes you ${amount}`
      : `you are owed ${amount}`
    : `you owe ${amount}`;

  return (
    <span
      className={cn(
        'text-sm font-medium tabular-nums',
        owedToUser
          ? 'text-emerald-600 dark:text-emerald-500'
          : 'text-destructive',
        className,
      )}
    >
      {text}
    </span>
  );
}
