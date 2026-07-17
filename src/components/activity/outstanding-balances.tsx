import { SharedSettleDialog } from '@/components/activity/shared-settle-dialog';
import { BalanceLabel } from '@/components/common/money';
import { SettleUpDialog } from '@/components/settlements/settlement-controls';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SharedBalance } from '@/lib/queries/balances';
import type { MemberWithBalance } from '@/types/dto';

/**
 * The actionable half of the Activity page: who currently owes whom, each settle-able
 * in place. Two kinds sit together, because to the reader they're the same thing —
 * money outstanding with a person:
 *
 *   - balances in **your own** ledger (people you added), and
 *   - balances in **someone else's** ledger where you're a participant — the other
 *     side of the single-owner model, settle-able by you since 0021.
 *
 * Both are **derived on read** from the one balance engine rather than stored — a
 * balance is a live figure, not something that happened once, so it can't drift from
 * the ledger the way a saved copy would. Settling writes a single shared row and
 * realtime clears it from every affected page on both accounts.
 */
export function OutstandingBalances({
  balances,
  shared,
  selfMemberId,
}: {
  /** Non-self members the owner has a live (non-zero) balance with. */
  balances: MemberWithBalance[];
  /** Live balances the user has inside other people's ledgers. */
  shared: SharedBalance[];
  selfMemberId: string | null;
}) {
  const total = balances.length + shared.length;
  if (total === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          Outstanding balances
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
            {total}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border/50">
          {balances.map(({ member, netCents }) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <Person name={member.name} netCents={netCents} />
              {selfMemberId ? (
                <SettleUpDialog
                  selfMemberId={selfMemberId}
                  memberId={member.id}
                  memberName={member.name}
                  netCents={netCents}
                  className="h-9 shrink-0"
                />
              ) : null}
            </li>
          ))}

          {shared.map((entry) => (
            <li
              key={entry.memberId}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <Person name={entry.counterpartyName} netCents={entry.netCents} />
              <SharedSettleDialog
                memberId={entry.memberId}
                counterpartyName={entry.counterpartyName}
                netCents={entry.netCents}
              />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** Avatar + name + which way the balance runs. */
function Person({ name, netCents }: { name: string; netCents: number }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar name={name} className="h-9 w-9 shrink-0" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium" title={name}>
          {name}
        </span>
        <BalanceLabel netCents={netCents} subject="them" className="mt-0.5 block" />
      </span>
    </span>
  );
}
