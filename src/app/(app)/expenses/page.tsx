import type { Metadata } from 'next';
import Link from 'next/link';

import { CheckCircle2, Plus, Receipt, SearchX, Users2 } from 'lucide-react';

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
import { listExpenses, normalizeSearchTerm } from '@/lib/queries/expenses';
import { getMembers } from '@/lib/queries/members';
import type { ExpenseListItem } from '@/types/dto';

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
 * Expenses list page. Shows every expense the user can see — their own and any shared
 * with them (each row says which) — through the shared filter layer, so search /
 * category / person / status / date-range / sort from the URL are all honoured.
 *
 * With no active filters the list is split by scope first — **Group expenses**, then
 * **Non-group expenses** — because "who is this split with" is the question people
 * actually navigate by; within each scope it splits Outstanding from Settled. With
 * filters active it collapses to a single flat result set so matches are easy to scan.
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

  const [expenses, categories, members] = await Promise.all([
    listExpenses({
      sort,
      search,
      categoryId: Number.isNaN(categoryId) ? undefined : categoryId,
      memberId: memberId || undefined,
      status,
      from: from || undefined,
      to: to || undefined,
    }),
    listCategories(),
    getMembers(),
  ]);

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

  if (expenses.length === 0 && !hasActiveFilters) {
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

  // Default view: split by scope (group vs not), then by settled state within each.
  const grouped = expenses.filter((item) => item.expense.group_id !== null);
  const general = expenses.filter((item) => item.expense.group_id === null);

  return (
    <section className="space-y-6">
      {header}
      {filters}

      {grouped.length > 0 ? (
        <ScopeSection
          title="Group expenses"
          icon={<Users2 className="h-4 w-4 text-muted-foreground" />}
          items={grouped}
          currentUserId={user.id}
        />
      ) : null}

      {general.length > 0 ? (
        <ScopeSection
          title="Non-group expenses"
          icon={<Receipt className="h-4 w-4 text-muted-foreground" />}
          items={general}
          currentUserId={user.id}
        />
      ) : null}
    </section>
  );
}

/**
 * One scope's expenses (group or non-group), split into Outstanding and Settled. The
 * Outstanding heading carries the amount still to settle — the figure people scan for.
 */
function ScopeSection({
  title,
  icon,
  items,
  currentUserId,
}: {
  title: string;
  icon: React.ReactNode;
  items: ExpenseListItem[];
  currentUserId: string;
}) {
  // Effective settled state (manual flag OR fully paid off, migration 0031), so a
  // balance the other account has settled moves into "Settled" and out of the
  // "to settle" total — matching the green check on each row.
  const outstanding = items.filter((item) => !item.fullySettled);
  const settled = items.filter((item) => item.fullySettled);
  const outstandingTotal = outstanding.reduce(
    (sum, item) => sum + item.expense.amount_cents,
    0,
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
            {items.length}
          </span>
        </CardTitle>
        {outstanding.length > 0 ? (
          <span className="text-sm font-medium tabular-nums text-muted-foreground">
            <Money cents={outstandingTotal} /> to settle
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        {outstanding.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-income/15 text-income ring-1 ring-inset ring-income/25 [&_svg]:h-6 [&_svg]:w-6">
              <CheckCircle2 />
            </span>
            <p className="text-sm text-muted-foreground">
              All settled up here 🎉
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <SectionLabel>Outstanding · {outstanding.length}</SectionLabel>
            <ExpenseList expenses={outstanding} currentUserId={currentUserId} />
          </div>
        )}

        {settled.length > 0 ? (
          <div className="space-y-2">
            <SectionLabel>Settled · {settled.length}</SectionLabel>
            <ExpenseList expenses={settled} currentUserId={currentUserId} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}
