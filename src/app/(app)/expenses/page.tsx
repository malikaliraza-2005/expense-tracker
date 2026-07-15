import type { Metadata } from 'next';
import Link from 'next/link';

import { CheckCircle2, Plus, Receipt } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { Money } from '@/components/common/money';
import { PageHeader } from '@/components/common/page-header';
import { ExpenseFilters } from '@/components/expenses/expense-filters';
import { ExpenseList } from '@/components/expenses/expense-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import { requireUser } from '@/lib/auth';
import { listExpenses } from '@/lib/queries/expenses';

export const metadata: Metadata = { title: 'Expenses' };

/**
 * Expenses list page. Reads the owner's expenses and splits them into
 * "Outstanding" (not yet settled) and "Settled" sections. When everything is
 * settled, the outstanding section shows a celebratory all-settled state.
 */
export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { sort?: string };
}) {
  const user = await requireUser();
  const sort = searchParams.sort === 'oldest' ? 'oldest' : 'newest';
  const expenses = await listExpenses({ sort });

  const outstanding = expenses.filter((e) => !e.expense.settled_at);
  const settled = expenses.filter((e) => e.expense.settled_at);
  const outstandingTotal = outstanding.reduce(
    (sum, e) => sum + e.expense.amount_cents,
    0,
  );

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Activity"
        title="Expenses"
        description="Everything you've added or been split into."
        action={
          <Button asChild variant="gradient">
            <Link href={ROUTES.newExpense}>
              <Plus />
              Add expense
            </Link>
          </Button>
        }
      />

      {expenses.length === 0 ? (
        <EmptyState
          icon={<Receipt />}
          title="No expenses yet"
          description="Add your first expense and split it equally among your members."
          action={
            <Button asChild variant="gradient">
              <Link href={ROUTES.newExpense}>
                <Plus />
                Add expense
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex justify-end">
            <ExpenseFilters sort={sort} />
          </div>

          {/* Outstanding */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                Outstanding
                {outstanding.length > 0 ? (
                  <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                    {outstanding.length}
                  </span>
                ) : null}
              </CardTitle>
              {outstanding.length > 0 ? (
                <span className="text-sm font-medium tabular-nums text-muted-foreground">
                  <Money cents={outstandingTotal} /> to settle
                </span>
              ) : null}
            </CardHeader>
            <CardContent>
              {outstanding.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-income/15 text-income ring-1 ring-inset ring-income/25 [&_svg]:h-7 [&_svg]:w-7">
                    <CheckCircle2 />
                  </span>
                  <div>
                    <p className="font-semibold">All settled up 🎉</p>
                    <p className="text-sm text-muted-foreground">
                      Every expense here has been marked settled.
                    </p>
                  </div>
                </div>
              ) : (
                <ExpenseList expenses={outstanding} currentUserId={user.id} />
              )}
            </CardContent>
          </Card>

          {/* Settled */}
          {settled.length > 0 ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  Settled
                  <span className="rounded-full bg-income/15 px-2 py-0.5 text-xs font-medium text-income">
                    {settled.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ExpenseList expenses={settled} currentUserId={user.id} />
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </section>
  );
}
