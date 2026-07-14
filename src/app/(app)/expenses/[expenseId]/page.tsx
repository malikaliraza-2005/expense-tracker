import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowLeft } from 'lucide-react';

import { ExpenseDetail } from '@/components/expenses/expense-detail';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { requireUser } from '@/lib/auth';
import { getExpense } from '@/lib/queries/expenses';

export const metadata: Metadata = { title: 'Expense' };

/**
 * Expense detail page (Phase 4). Shows the expense, its category/payer/group,
 * and each participant's share. RLS-hidden or unknown expenses resolve to 404.
 * The creator sees edit/delete controls.
 */
export default async function ExpenseDetailPage({
  params,
}: {
  params: { expenseId: string };
}) {
  const user = await requireUser();
  const detail = await getExpense(params.expenseId);
  if (!detail) notFound();

  return (
    <section className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href={ROUTES.expenses}>
          <ArrowLeft />
          Back to expenses
        </Link>
      </Button>

      <ExpenseDetail detail={detail} currentUserId={user.id} />
    </section>
  );
}
