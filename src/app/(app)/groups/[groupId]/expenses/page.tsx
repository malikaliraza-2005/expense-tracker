import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowLeft, Plus, Receipt } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { ExpenseFilters } from '@/components/expenses/expense-filters';
import { ExpenseList } from '@/components/expenses/expense-list';
import { Button } from '@/components/ui/button';
import { requireUser } from '@/lib/auth';
import { listExpenses } from '@/lib/queries/expenses';
import { getGroup } from '@/lib/queries/groups';

export const metadata: Metadata = { title: 'Group expenses' };

/**
 * Group expenses page (Phase 4). Lists one group's expenses (RLS-scoped) and
 * offers an add affordance that preselects the group in the expense form.
 * Unknown / RLS-hidden groups resolve to 404.
 */
export default async function GroupExpensesPage({
  params,
  searchParams,
}: {
  params: { groupId: string };
  searchParams: { sort?: string };
}) {
  const user = await requireUser();
  const group = await getGroup(params.groupId);
  if (!group) notFound();

  const sort = searchParams.sort === 'oldest' ? 'oldest' : 'newest';
  const expenses = await listExpenses({ groupId: params.groupId, sort });

  const addHref = `/expenses/new?group=${params.groupId}`;

  return (
    <section className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href={`/groups/${params.groupId}`}>
          <ArrowLeft />
          Back to group
        </Link>
      </Button>

      <PageHeader
        title={`${group.group.name} · Expenses`}
        action={
          <Button asChild>
            <Link href={addHref}>
              <Plus />
              Add expense
            </Link>
          </Button>
        }
      />

      {expenses.length === 0 ? (
        <EmptyState
          icon={<Receipt />}
          title="No expenses in this group yet"
          description="Add the first shared expense to start tracking who owes whom."
          action={
            <Button asChild>
              <Link href={addHref}>
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
