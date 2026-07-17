import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/common/page-header';
import { ExpenseForm } from '@/components/expenses/expense-form';
import { Card, CardContent } from '@/components/ui/card';
import { getUser } from '@/lib/auth';
import { listCategories } from '@/lib/queries/categories';
import { getExpenseFormData } from '@/lib/queries/expenses';
import { toISODate } from '@/utils/date';

export const metadata: Metadata = { title: 'New expense' };

/**
 * New-expense page. Loads the current members (for "Paid by" / "Split between")
 * and categories, then renders the shared expense form. New people can be added
 * inline from the form itself.
 */
export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: { group?: string };
}) {
  const [formData, categories, user] = await Promise.all([
    getExpenseFormData(),
    listCategories(),
    getUser(),
  ]);
  if (!formData) notFound();

  // A `?group=` that matches a real scope pre-points the form at that group.
  const groupParam = searchParams.group?.trim();
  const defaultGroupId = formData.scopes.some((scope) => scope.id === groupParam)
    ? groupParam ?? null
    : null;

  return (
    <section className="mx-auto max-w-xl space-y-6">
      {/* No bespoke back link: the app header's back arrow covers every page. */}
      <PageHeader
        title="Add expense"
        description="Enter the details, then choose how to split it."
      />

      <Card>
        <CardContent className="pt-6">
          <ExpenseForm
            mode="create"
            categories={categories}
            scopes={formData.scopes}
            selfMemberId={formData.selfMemberId}
            defaultDate={toISODate(new Date())}
            defaultGroupId={defaultGroupId}
            userId={user?.id}
          />
        </CardContent>
      </Card>
    </section>
  );
}
