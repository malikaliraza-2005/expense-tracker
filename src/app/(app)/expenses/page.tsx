import type { Metadata } from 'next';
import Link from 'next/link';

import { Plus, Receipt } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { ExpenseFilters } from '@/components/expenses/expense-filters';
import { ExpenseList } from '@/components/expenses/expense-list';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { requireUser } from '@/lib/auth';
import { listExpenses } from '@/lib/queries/expenses';

export const metadata: Metadata = { title: 'Expenses' };

/**
 * Expenses list page (Phase 4). Server Component: reads the RLS-scoped expenses
 * (newest first by default; `?sort=oldest` flips it) and renders the add
 * affordance, sort control, and interactive list.
 */
export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { sort?: string };
}) {
  const user = await requireUser();
  const sort = searchParams.sort === 'oldest' ? 'oldest' : 'newest';
  const expenses = await listExpenses({ sort });

  return (
    <section className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Everything you've added or been split into."
        action={
          <Button asChild>
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
          description="Add your first expense and split it with friends or a group."
          action={
            <Button asChild>
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
          <ExpenseList expenses={expenses} currentUserId={user.id} />
        </>
      )}
    </section>
  );
}
