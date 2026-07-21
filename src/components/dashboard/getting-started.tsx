import Link from 'next/link';

import { CheckCircle2, Circle } from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/utils/cn';

/**
 * First-run onboarding nudge (server component). A three-step checklist that
 * guides a new owner through the core loop — add an expense, add people to split
 * with, record a payment — and disappears on its own once all three are done. It
 * is purely data-driven (no dismissal state), so it always reflects real
 * progress and never lingers or has to be re-shown.
 */
export function GettingStarted({
  name,
  hasExpense,
  hasPeople,
  hasPayment,
}: {
  name: string | null;
  hasExpense: boolean;
  hasPeople: boolean;
  hasPayment: boolean;
}) {
  const steps = [
    {
      done: hasExpense,
      label: 'Add your first expense',
      hint: 'Record something you paid for and split it.',
      href: ROUTES.newExpense,
    },
    {
      done: hasPeople,
      label: 'Add someone to split with',
      hint: 'Add people right from the expense form.',
      href: ROUTES.newExpense,
    },
    {
      done: hasPayment,
      label: 'Record a payment',
      hint: 'Open an expense and settle up when a balance is paid.',
      href: ROUTES.expenses,
    },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  const firstName = name?.trim().split(/\s+/)[0] ?? null;

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">
          {firstName ? `Welcome, ${firstName} 👋` : 'Welcome 👋'}
        </CardTitle>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
          {doneCount}/{steps.length}
        </span>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          A couple of quick steps to get the most out of your tracker.
        </p>
        <ul className="space-y-1">
          {steps.map((step) => {
            const content = (
              <>
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-income" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground/50" />
                )}
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block text-sm font-medium',
                      step.done && 'text-muted-foreground line-through',
                    )}
                  >
                    {step.label}
                  </span>
                  {!step.done ? (
                    <span className="block text-xs text-muted-foreground">
                      {step.hint}
                    </span>
                  ) : null}
                </span>
              </>
            );
            return (
              <li key={step.label}>
                {step.done ? (
                  <div className="flex items-center gap-3 rounded-lg px-2 py-2">
                    {content}
                  </div>
                ) : (
                  <Link
                    href={step.href}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
