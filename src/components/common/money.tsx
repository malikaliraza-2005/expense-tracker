'use client';

import * as React from 'react';

import { useCurrency } from '@/components/providers/currency-provider';
import { cn } from '@/utils/cn';

/**
 * Money & balance display primitives. `formatCents` (utils/money.ts) is the only
 * sanctioned cents→string bridge; these components wrap it so amounts and
 * directional balances render consistently everywhere.
 */

export interface MoneyProps extends React.HTMLAttributes<HTMLSpanElement> {
  cents: number;
}

/** A plain formatted currency amount in the user's chosen currency. */
export function Money({ cents, className, ...props }: MoneyProps) {
  const { format } = useCurrency();
  return (
    <span className={cn('tabular-nums', className)} {...props}>
      {format(cents)}
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
  const { format } = useCurrency();
  if (netCents === 0) {
    return (
      <span className={cn('text-sm text-muted-foreground', className)}>
        Settled up
      </span>
    );
  }

  const owedToUser = netCents > 0;
  const amount = format(Math.abs(netCents));
  const text = owedToUser
    ? subject === 'them'
      ? `owes you ${amount}`
      : `you are owed ${amount}`
    : `you owe ${amount}`;

  return (
    <span
      className={cn(
        'text-sm font-medium tabular-nums',
        // Green = positive/owed-to-you, red = negative/you-owe (semantic tokens).
        owedToUser ? 'text-income' : 'text-expense',
        className,
      )}
    >
      {text}
    </span>
  );
}
