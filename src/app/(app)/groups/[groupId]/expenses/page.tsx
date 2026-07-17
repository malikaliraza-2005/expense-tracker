import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Plus, Receipt, X } from 'lucide-react';

import { ExpenseList } from '@/components/expenses/expense-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import { requireUser } from '@/lib/auth';
import { listExpenses } from '@/lib/queries/expenses';
import { getGroup, getGroupMembersWithStats } from '@/lib/queries/groups';

export const metadata = { title: 'Group expenses' };

/**
 * Group Expenses tab: every expense in this group, newest first, optionally
 * filtered to one member via `?who=`. Strictly scoped by `groupId`, so no
 * personal or other-group expenses appear. Each row opens the expense detail,
 * where it can be edited or deleted.
 */
export default async function GroupExpensesPage({
  params,
  searchParams,
}: {
  params: { groupId: string };
  searchParams: { who?: string };
}) {
  const user = await requireUser();
  const group = await getGroup(params.groupId);
  if (!group) notFound();

  const who = searchParams.who;
  const [expenses, members] = await Promise.all([
    listExpenses({ groupId: params.groupId, memberId: who }),
    who ? getGroupMembersWithStats(params.groupId) : Promise.resolve([]),
  ]);
  const filteredMember = who
    ? members.find((entry) => entry.member.id === who)?.member
    : undefined;

  const base = `${ROUTES.groups}/${group.id}/expenses`;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">
          {filteredMember
            ? `Expenses with ${filteredMember.is_self ? 'you' : filteredMember.name}`
            : 'Expenses'}
        </CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link href={`${ROUTES.newExpense}?group=${group.id}`}>
            <Plus />
            Add
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {filteredMember ? (
          <Link
            href={base}
            className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3 w-3" />
            Clear filter
          </Link>
        ) : null}

        {expenses.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground [&_svg]:h-6 [&_svg]:w-6">
              <Receipt />
            </span>
            <p className="text-sm text-muted-foreground">
              {filteredMember
                ? 'No expenses involve this person yet.'
                : 'No expenses in this group yet.'}
            </p>
          </div>
        ) : (
          <ExpenseList expenses={expenses} currentUserId={user.id} />
        )}
      </CardContent>
    </Card>
  );
}
