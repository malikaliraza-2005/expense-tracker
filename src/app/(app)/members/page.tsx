import type { Metadata } from 'next';
import Link from 'next/link';

import { Plus, Users } from 'lucide-react';

import { LocalDate } from '@/components/common/local-date';
import { EmptyState } from '@/components/common/empty-state';
import { Money } from '@/components/common/money';
import { PageHeader } from '@/components/common/page-header';
import { PeopleList } from '@/components/members/people-list';
import { DeleteSettlementButton } from '@/components/settlements/settlement-controls';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import { requireUser } from '@/lib/auth';
import { getSelfMemberId } from '@/lib/queries/balances';
import { getMembersWithBalances } from '@/lib/queries/members';
import { listSettlements } from '@/lib/queries/settlements';

export const metadata: Metadata = { title: 'People' };

/**
 * People directory. Lists everyone the owner splits with and where they stand
 * with each — "owes you", "you owe", or "settled up" — with the totals up top
 * and a "Settle up" action that records a payment to clear (or partly clear) a
 * balance. Recorded payments show below as history. The owner's own self-member
 * is excluded (a balance with yourself is always zero).
 */
export default async function MembersPage() {
  const user = await requireUser();
  const [all, selfMemberId, settlements] = await Promise.all([
    getMembersWithBalances(),
    getSelfMemberId(),
    listSettlements(),
  ]);
  const people = all.filter((entry) => !entry.member.is_self);

  // Totals across everyone: what you're owed vs. what you owe.
  let owedToYouCents = 0;
  let youOweCents = 0;
  for (const { netCents } of people) {
    if (netCents > 0) owedToYouCents += netCents;
    else if (netCents < 0) youOweCents += -netCents;
  }

  const header = (
    <PageHeader
      eyebrow="People"
      title="People"
      description="Everyone you split with, and where you stand with each."
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

  if (people.length === 0) {
    return (
      <section className="space-y-6">
        {header}
        <EmptyState
          icon={<Users />}
          title="No people yet"
          description="Add someone while creating an expense — the people you split with show up here with your running balance."
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

  return (
    <section className="space-y-6">
      {header}

      {/* Totals */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 py-5">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Owed to you
            </p>
            <Money
              cents={owedToYouCents}
              className="text-xl font-semibold text-emerald-600 dark:text-emerald-500"
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              You owe
            </p>
            <Money
              cents={youOweCents}
              className="text-xl font-semibold text-destructive"
            />
          </div>
        </CardContent>
      </Card>

      {/* People list — searchable, with inline add + invite */}
      <PeopleList
        people={people.map(({ member, netCents }) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          netCents,
        }))}
        selfMemberId={selfMemberId}
        inviteRef={user.id}
      />

      {/* Payment history */}
      {settlements.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent payments</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {settlements.map(({ settlement, payer, receiver }) => {
                const line = payer.is_self
                  ? `You paid ${receiver.name}`
                  : receiver.is_self
                    ? `${payer.name} paid you`
                    : `${payer.name} paid ${receiver.name}`;
                return (
                  <li
                    key={settlement.id}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{line}</p>
                      <p className="text-xs text-muted-foreground">
                        <LocalDate value={settlement.settled_at} />
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Money
                        cents={settlement.amount_cents}
                        className="text-sm font-medium tabular-nums"
                      />
                      <DeleteSettlementButton
                        settlementId={settlement.id}
                        label={line}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
