import { BalanceLabel } from '@/components/common/money';
import { SettleUpDialog } from '@/components/settlements/settlement-controls';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MemberWithBalance } from '@/types/dto';

/**
 * The actionable half of the Activity page: who currently owes whom, each settle-able
 * in place.
 *
 * These rows are **derived on read** from the balance engine rather than stored as
 * events — a balance is a live figure, not something that happened once, so it can
 * never drift from the ledger the way a saved copy would. Settling here writes through
 * the same action as everywhere else, and realtime refreshes every affected page, so
 * the figure disappears from this list the moment it's cleared.
 */
export function OutstandingBalances({
  balances,
  selfMemberId,
}: {
  /** Non-self members the owner has a live (non-zero) balance with. */
  balances: MemberWithBalance[];
  selfMemberId: string | null;
}) {
  if (balances.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          Outstanding balances
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
            {balances.length}
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
              <span className="flex min-w-0 items-center gap-3">
                <Avatar name={member.name} className="h-9 w-9 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium" title={member.name}>
                    {member.name}
                  </span>
                  <BalanceLabel
                    netCents={netCents}
                    subject="them"
                    className="mt-0.5 block"
                  />
                </span>
              </span>
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
        </ul>
      </CardContent>
    </Card>
  );
}
