import type { Metadata } from 'next';
import Link from 'next/link';

import { CheckCircle2, Plus, Receipt, SearchX, Users } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { Money } from '@/components/common/money';
import { PageHeader } from '@/components/common/page-header';
import { ExpenseFilters } from '@/components/expenses/expense-filters';
import { ExpenseList } from '@/components/expenses/expense-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import { requireUser } from '@/lib/auth';
import { listCategories } from '@/lib/queries/categories';
import {
  listExpenses,
  listSharedWithMe,
  normalizeSearchTerm,
} from '@/lib/queries/expenses';
import { getMembers } from '@/lib/queries/members';

export const metadata: Metadata = { title: 'Expenses' };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface ExpensesSearchParams {
  sort?: string;
  q?: string;
  cat?: string;
  who?: string;
  status?: string;
  from?: string;
  to?: string;
}

/**
 * Expenses list page. Reads the owner's expenses through the shared filter
 * layer, so search / category / person / status / date-range / sort from the URL
 * are all honoured. With no active filters it splits results into "Outstanding"
 * and "Settled" sections; with filters it shows a single flat result set so the
 * matches are easy to scan.
 */
export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: ExpensesSearchParams;
}) {
  const user = await requireUser();

  // Parse and normalise every filter dimension from the URL.
  const sort = searchParams.sort === 'oldest' ? 'oldest' : 'newest';
  // Normalise to what the query will actually search on, so a term of only
  // punctuation counts as no search (sectioned view, not an empty "Results").
  const search = normalizeSearchTerm(searchParams.q);
  const categoryId = Number.parseInt(searchParams.cat ?? '', 10);
  const memberId = (searchParams.who ?? '').trim();
  const status =
    searchParams.status === 'outstanding' || searchParams.status === 'settled'
      ? searchParams.status
      : 'all';
  const from = ISO_DATE.test(searchParams.from ?? '') ? searchParams.from! : '';
  const to = ISO_DATE.test(searchParams.to ?? '') ? searchParams.to! : '';

  const [expenses, sharedWithMe, categories, members] = await Promise.all([
    listExpenses({
      sort,
      search,
      categoryId: Number.isNaN(categoryId) ? undefined : categoryId,
      memberId: memberId || undefined,
      status,
      from: from || undefined,
      to: to || undefined,
    }),
    listSharedWithMe(),
    listCategories(),
    getMembers(),
  ]);

  // Expenses others added that this user is part of (claimed participant). Shown
  // read-only as a separate section, never mixed into the owner's own lists.
  const sharedSection =
    sharedWithMe.length > 0 ? (
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-muted-foreground" />
            Shared with me
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
              {sharedWithMe.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ExpenseList expenses={sharedWithMe} currentUserId={user.id} />
        </CardContent>
      </Card>
    ) : null;

  const hasActiveFilters =
    Boolean(search || memberId || from || to) ||
    (!Number.isNaN(categoryId) && searchParams.cat !== undefined) ||
    status !== 'all';

  const filters = (
    <ExpenseFilters
      sort={sort}
      search={search}
      categoryId={Number.isNaN(categoryId) ? '' : String(categoryId)}
      memberId={memberId}
      status={status}
      from={from}
      to={to}
      categories={categories.map((category) => ({
        value: String(category.id),
        label: category.name,
      }))}
      members={members.map((member) => ({
        value: member.id,
        label: member.is_self ? 'You' : member.name,
      }))}
    />
  );

  const header = (
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
  );

  // Nothing of the user's own AND nothing shared with them: pure onboarding.
  if (expenses.length === 0 && !hasActiveFilters && sharedWithMe.length === 0) {
    return (
      <section className="space-y-6">
        {header}
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
      </section>
    );
  }

  // Filters active: one flat, easy-to-scan result set.
  if (hasActiveFilters) {
    const total = expenses.reduce((sum, e) => sum + e.expense.amount_cents, 0);
    return (
      <section className="space-y-6">
        {header}
        {filters}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              Results
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                {expenses.length}
              </span>
            </CardTitle>
            {expenses.length > 0 ? (
              <span className="text-sm font-medium tabular-nums text-muted-foreground">
                <Money cents={total} /> total
              </span>
            ) : null}
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground [&_svg]:h-7 [&_svg]:w-7">
                  <SearchX />
                </span>
                <div>
                  <p className="font-semibold">No matching expenses</p>
                  <p className="text-sm text-muted-foreground">
                    Try a different search or clear the filters.
                  </p>
                </div>
              </div>
            ) : (
              <ExpenseList expenses={expenses} currentUserId={user.id} />
            )}
          </CardContent>
        </Card>
      </section>
    );
  }

  // Default view: Outstanding + Settled sections.
  const outstanding = expenses.filter((e) => !e.expense.settled_at);
  const settled = expenses.filter((e) => e.expense.settled_at);
  const outstandingTotal = outstanding.reduce(
    (sum, e) => sum + e.expense.amount_cents,
    0,
  );

  return (
    <section className="space-y-6">
      {header}
      {filters}

      {expenses.length === 0 ? (
        // No expenses of their own, but something is shared with them below.
        <EmptyState
          icon={<Receipt />}
          title="None of your own yet"
          description="Add an expense to start splitting, or view what's shared with you below."
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

      {/* Shared with me — expenses others added that I'm part of (read-only). */}
      {sharedSection}
    </section>
  );
}
