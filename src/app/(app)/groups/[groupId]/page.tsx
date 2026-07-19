import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Plus, Receipt } from 'lucide-react';

import { Money } from '@/components/common/money';
import { ExpenseList } from '@/components/expenses/expense-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import { requireUser } from '@/lib/auth';
import { listExpenses } from '@/lib/queries/expenses';
import { getGroupDetail } from '@/lib/queries/groups';

export const metadata = { title: 'Group' };

const RECENT_LIMIT = 5;

/**
 * Group Overview tab: the owner's balance within this group and a peek at the
 * most recent group expenses. Everything is scoped to `groupId` — the summary
 * comes from the balance engine restricted to the group, and the expense list is
 * filtered by group. Members and the full ledger live on their own tabs.
 *
 * Adding an expense is the owner's alone: an expense belongs to the ledger that owns the
 * group, so a participant's "Add" could only ever write into someone else's group.
 */
export default async function GroupOverviewPage({
  params,
}: {
  params: { groupId: string };
}) {
  const user = await requireUser();
  const [detail, expenses] = await Promise.all([
    getGroupDetail(params.groupId),
    listExpenses({ groupId: params.groupId }),
  ]);
  if (!detail) notFound();

  const { group, summary } = detail;
  const isOwner = group.owner_id === user.id;
  const recent = expenses.slice(0, RECENT_LIMIT);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {summary.memberCount} {summary.memberCount === 1 ? 'person' : 'people'} ·{' '}
        {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}
      </p>

      {/* Your balance within the group */}
      <Card>
        <CardContent className="grid grid-cols-2 items-center gap-4 p-5 sm:p-6">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Owed to you
            </p>
            <Money
              cents={summary.owedToMeCents}
              className="text-xl font-semibold text-income"
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              You owe
            </p>
            <Money
              cents={summary.iOweCents}
              className="text-xl font-semibold text-destructive"
            />
          </div>
        </CardContent>
      </Card>

      {/* Recent expenses */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Recent expenses</CardTitle>
          {isOwner ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`${ROUTES.newExpense}?group=${group.id}`}>
                <Plus />
                Add
              </Link>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground [&_svg]:h-6 [&_svg]:w-6">
                <Receipt />
              </span>
              <p className="text-sm text-muted-foreground">
                No expenses in this group yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <ExpenseList expenses={recent} currentUserId={user.id} />
              {expenses.length > recent.length ? (
                <Button asChild variant="ghost" size="sm" className="w-full">
                  <Link href={`${ROUTES.groups}/${group.id}/expenses`}>
                    View all {expenses.length} expenses
                  </Link>
                </Button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
