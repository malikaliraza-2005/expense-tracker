'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { CheckCircle2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { setExpenseSettled } from '@/actions/expenses';
import { Button } from '@/components/ui/button';

/**
 * Toggles an expense between outstanding and settled. When outstanding it shows
 * a primary "Mark as settled" action; when settled it offers "Reopen". Optimistic
 * feedback via a pending state; refreshes so the dashboard/list re-filter.
 */
export function SettleToggle({
  expenseId,
  settled,
  className,
}: {
  expenseId: string;
  settled: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await setExpenseSettled({ expenseId, settled: !settled });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(settled ? 'Marked as outstanding.' : 'Marked as settled.');
      router.refresh();
    });
  }

  if (settled) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={toggle}
        disabled={isPending}
        className={className}
      >
        <RotateCcw />
        {isPending ? 'Reopening…' : 'Reopen'}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="gradient"
      onClick={toggle}
      disabled={isPending}
      className={className}
    >
      <CheckCircle2 />
      {isPending ? 'Settling…' : 'Mark as settled'}
    </Button>
  );
}
