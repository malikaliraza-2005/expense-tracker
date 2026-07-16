import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowLeft } from 'lucide-react';

import {
  ExpenseDetail,
  type ExpensePayment,
} from '@/components/expenses/expense-detail';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { requireUser } from '@/lib/auth';
import {
  getBalances,
  getGroupBalances,
  getSelfMemberId,
} from '@/lib/queries/balances';
import { getExpense } from '@/lib/queries/expenses';
import { listSettlements } from '@/lib/queries/settlements';

export const metadata: Metadata = { title: 'Expense' };

/**
 * Expense detail page. Shows the expense, its category/payer/group, and each
 * participant's share. RLS-hidden or unknown expenses resolve to 404. The owner
 * sees edit/delete/settle controls; a shared (claimed-participant) viewer sees a
 * read-only view.
 */
export default async function ExpenseDetailPage({
  params,
}: {
  params: { expenseId: string };
}) {
  const user = await requireUser();
  const detail = await getExpense(params.expenseId);
  if (!detail) notFound();

  // The viewer owns this expense (full controls) vs. sees it shared (read-only).
  const isOwner = detail.expense.owner_id === user.id;
  const groupId = detail.expense.group_id;

  // Settle-up + payment history are owner-only and settle the owner's OVERALL
  // balance with each person (group-scoped for a group expense), so only the
  // owner path pays for the extra reads.
  let selfMemberId: string | null = null;
  let netByMember: Record<string, number> = {};
  let payments: ExpensePayment[] = [];

  if (isOwner) {
    const [self, balances, settlements] = await Promise.all([
      getSelfMemberId(),
      groupId ? getGroupBalances(groupId) : getBalances(),
      listSettlements(),
    ]);
    selfMemberId = self;
    netByMember = Object.fromEntries(
      balances.map((balance) => [balance.memberId, balance.netCents]),
    );

    // Payments relevant to this expense: transfers in the same scope (this
    // group, or general) between the owner and someone on this expense.
    const involved = new Set<string>([
      ...(self ? [self] : []),
      ...detail.participants.map((participant) => participant.member.id),
    ]);
    payments = settlements
      .filter((item) =>
        groupId
          ? item.settlement.group_id === groupId
          : item.settlement.group_id === null,
      )
      .filter(
        (item) =>
          involved.has(item.settlement.payer_id) &&
          involved.has(item.settlement.receiver_id),
      )
      .map((item) => ({
        id: item.settlement.id,
        amountCents: item.settlement.amount_cents,
        settledAt: item.settlement.settled_at,
        label: item.payer.is_self
          ? `You paid ${item.receiver.name}`
          : item.receiver.is_self
            ? `${item.payer.name} paid you`
            : `${item.payer.name} paid ${item.receiver.name}`,
      }));
  }

  return (
    <section className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href={ROUTES.expenses}>
          <ArrowLeft />
          Back to expenses
        </Link>
      </Button>

      <ExpenseDetail
        detail={detail}
        currentUserId={user.id}
        isOwner={isOwner}
        selfMemberId={selfMemberId}
        netByMember={netByMember}
        payments={payments}
      />
    </section>
  );
}
