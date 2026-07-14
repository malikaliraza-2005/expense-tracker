import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { ExpenseForm } from '@/components/expenses/expense-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import { listCategories } from '@/lib/queries/categories';
import { getExpenseFormData } from '@/lib/queries/expenses';
import { toISODate } from '@/utils/date';

export const metadata: Metadata = { title: 'New expense' };

/**
 * New-expense page (Phase 4). Loads the scope choices (personal + groups with
 * members) and categories, then renders the shared expense form. An optional
 * `?group=<id>` preselects that group (e.g. when adding from a group page).
 */
export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: { group?: string };
}) {
  const [formData, categories] = await Promise.all([
    getExpenseFormData(),
    listCategories(),
  ]);
  if (!formData) notFound();

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href={ROUTES.expenses}>
          <ArrowLeft />
          Back to expenses
        </Link>
      </Button>

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
            currentUserId={formData.currentUserId}
            defaultScopeId={searchParams.group ?? null}
            defaultDate={toISODate(new Date())}
          />
        </CardContent>
      </Card>
    </section>
  );
}
