import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { ExpenseForm } from '@/components/expenses/expense-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { listCategories } from '@/lib/queries/categories';
import { getExpense, getExpenseFormData } from '@/lib/queries/expenses';

export const metadata: Metadata = { title: 'Edit expense' };

/**
 * Edit-expense page (Phase 4). Only the creator may edit — non-owners (and
 * unknown/RLS-hidden expenses) resolve to 404. Prefills the shared form with the
 * expense's current values and split, then `updateExpense` recomputes and
 * rewrites the splits atomically.
 */
export default async function EditExpensePage({
  params,
}: {
  params: { expenseId: string };
}) {
  const [detail, formData, categories] = await Promise.all([
    getExpense(params.expenseId),
    getExpenseFormData(),
    listCategories(),
  ]);
  if (!detail || !detail.isOwner || !formData) notFound();

  const { expense } = detail;

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href={`/expenses/${expense.id}`}>
          <ArrowLeft />
          Back to expense
        </Link>
      </Button>

      <PageHeader title="Edit expense" description="Update the details or split." />

      <Card>
        <CardContent className="pt-6">
          <ExpenseForm
            mode="edit"
            categories={categories}
            scopes={formData.scopes}
            currentUserId={formData.currentUserId}
            defaultDate={expense.expense_date}
            initial={{
              expenseId: expense.id,
              groupId: expense.group_id,
              title: expense.title,
              amountCents: expense.amount_cents,
              categoryId: expense.category_id,
              expenseDate: expense.expense_date,
              paidBy: expense.paid_by,
              description: expense.description,
              notes: expense.notes,
              splitType: detail.splitType,
              participants: detail.participants.map((participant) => ({
                userId: participant.profile.id,
                shareCents: participant.shareCents,
              })),
            }}
          />
        </CardContent>
      </Card>
    </section>
  );
}
