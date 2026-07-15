import Link from 'next/link';

import { CheckCircle2 } from 'lucide-react';

import { ExpenseList } from '@/components/expenses/expense-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import type { ExpenseListItem } from '@/types/dto';

/**
 * Dashboard "Outstanding expenses" panel (Server-rendered). Surfaces only the
 * not-yet-settled expenses. When there are none, it shows a celebratory
 * all-settled state instead of a dead end.
 */
export function RecentExpenses({
  expenses,
  currentUserId,
}: {
  expenses: ExpenseListItem[];
  currentUserId: string;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Outstanding expenses</CardTitle>
        {expenses.length > 0 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={ROUTES.expenses}>View all</Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-income/15 text-income ring-1 ring-inset ring-income/25 [&_svg]:h-7 [&_svg]:w-7">
              <CheckCircle2 />
            </span>
            <div>
              <p className="font-semibold">All settled up 🎉</p>
              <p className="text-sm text-muted-foreground">
                You have no outstanding expenses right now.
              </p>
            </div>
          </div>
        ) : (
          <ExpenseList expenses={expenses} currentUserId={currentUserId} />
        )}
      </CardContent>
    </Card>
  );
}
