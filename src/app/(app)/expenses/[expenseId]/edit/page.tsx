import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/common/page-header';
import { ExpenseForm } from '@/components/expenses/expense-form';
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
  if (!detail || !formData) notFound();

  const { expense } = detail;

  return (
    <section className="mx-auto max-w-xl space-y-6">
      {/* No bespoke back link: the app header's back arrow covers every page. */}
      <PageHeader title="Edit expense" description="Update the details or split." />

      <Card>
        <CardContent className="pt-6">
          <ExpenseForm
            mode="edit"
            categories={categories}
            scopes={formData.scopes}
            selfMemberId={formData.selfMemberId}
            personalGroupId={formData.personalGroupId}
            allMembers={formData.allMembers}
            defaultDate={expense.expense_date}
            initial={{
              expenseId: expense.id,
              groupId: expense.group_id,
              title: expense.title,
              amountCents: expense.amount_cents,
              categoryId: expense.category_id,
              expenseDate: expense.expense_date,
              paidBy: expense.paid_by,
              notes: expense.notes,
              memberIds: detail.participants.map((p) => p.member.id),
            }}
          />
        </CardContent>
      </Card>
    </section>
  );
}
