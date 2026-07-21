import { notFound } from 'next/navigation';

import { ArrowRight } from 'lucide-react';

import { Money } from '@/components/common/money';
import { LedgerSettleUpDialog } from '@/components/settlements/settlement-controls';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/auth';
import { getGroup, getGroupLedger } from '@/lib/queries/groups';

export const metadata = { title: 'Group balances' };

/**
 * Group Balances tab: the who-owes-whom ledger among this group's members, every
 * pair collapsed to a single directed debt, each settle-able in place. Scoped to
 * `groupId`, so it reflects only this group's expenses and settlements.
 */
export default async function GroupBalancesPage({
  params,
}: {
  params: { groupId: string };
}) {
  await requireUser();
  const group = await getGroup(params.groupId);
  if (!group) notFound();

  const ledger = await getGroupLedger(params.groupId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Who owes whom</CardTitle>
      </CardHeader>
      <CardContent>
        {ledger.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Everyone in this group is settled up.
          </p>
        ) : (
          <ul className="space-y-3">
            {ledger.map((entry) => {
              const fromName = entry.from.is_self ? 'You' : entry.from.name;
              const toName = entry.to.is_self ? 'You' : entry.to.name;
              return (
                <li
                  key={`${entry.from.id}-${entry.to.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/30 p-3"
                >
                  <span className="flex min-w-0 basis-full items-center gap-2 text-sm sm:basis-auto">
                    <Avatar name={entry.from.name} className="h-7 w-7" />
                    <span className="truncate font-medium">{fromName}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <Avatar name={entry.to.name} className="h-7 w-7" />
                    <span className="truncate font-medium">{toName}</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <Money
                      cents={entry.amountCents}
                      className="text-sm font-semibold tabular-nums"
                    />
                    <LedgerSettleUpDialog
                      fromId={entry.from.id}
                      fromName={fromName}
                      toId={entry.to.id}
                      toName={toName}
                      amountCents={entry.amountCents}
                      groupId={group.id}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
