import Link from 'next/link';

import { ExpenseList } from '@/components/expenses/expense-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import type { ExpenseListItem } from '@/types/dto';

/**
 * Dashboard "Recent expenses" panel (presentational, Server-rendered). Reuses the
 * Phase 4 {@link ExpenseList} for the rows and adds a header + "View all" link.
 * The empty case is a short prompt rather than a dead-end.
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
        <CardTitle className="text-base">Recent expenses</CardTitle>
        {expenses.length > 0 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={ROUTES.expenses}>View all</Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No expenses yet — add one to start tracking who owes what.
          </p>
        ) : (
          <ExpenseList expenses={expenses} currentUserId={currentUserId} />
        )}
      </CardContent>
    </Card>
  );
}
