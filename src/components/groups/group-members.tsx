import Link from 'next/link';

import { ArrowUpRight } from 'lucide-react';

import { Money } from '@/components/common/money';
import { MemberRowActions } from '@/components/members/member-row-actions';
import { SettleUpDialog } from '@/components/settlements/settlement-controls';
import { Avatar } from '@/components/ui/avatar';
import { ROUTES } from '@/constants/routes';
import type { GroupMemberStatDto } from '@/types/dto';
import { cn } from '@/utils/cn';

/**
 * The group's member cards: each person with their in-group Paid, Owes, and
 * Balance, plus View details (their expenses in this group), Edit (name/email),
 * and Settle up. Balance and Settle up are owner-centric — the figure the owner
 * can actually clear — so the self ("You") card shows only its contribution.
 * Server-rendered; the interactive controls are client leaves.
 */
export function GroupMembers({
  groupId,
  selfMemberId,
  members,
}: {
  groupId: string;
  selfMemberId: string | null;
  members: GroupMemberStatDto[];
}) {
  if (members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No members yet. Add people above to start splitting.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {members.map((entry) => {
        const { member, isSelf, paidCents, owesCents, ownerNetCents } = entry;
        const name = isSelf ? 'You' : member.name;
        const canSettle = !isSelf && ownerNetCents !== 0 && selfMemberId;

        return (
          <li
            key={member.id}
            className="flex flex-col gap-3 rounded-xl border border-border/50 bg-background/30 p-4"
          >
            {/* Identity + edit menu */}
            <div className="flex items-start gap-3">
              <Avatar name={member.name} className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{name}</p>
                {member.email ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {member.email}
                  </p>
                ) : null}
              </div>
              {!isSelf ? (
                <MemberRowActions
                  memberId={member.id}
                  memberName={member.name}
                  memberEmail={member.email}
                />
              ) : null}
            </div>

            {/* Paid / Owes / Balance */}
            <dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted/30 p-3 text-center">
              <Stat label="Paid">
                <Money cents={paidCents} className="text-sm font-semibold" />
              </Stat>
              <Stat label="Owes">
                <Money cents={owesCents} className="text-sm font-semibold" />
              </Stat>
              <Stat label="Balance">
                <BalanceValue netCents={isSelf ? entry.netCents : ownerNetCents} />
              </Stat>
            </dl>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Link
                href={`${ROUTES.groups}/${groupId}/expenses?who=${member.id}`}
                className="inline-flex min-h-9 flex-1 items-center justify-center gap-1 rounded-md border border-border/60 px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:bg-accent/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                View details
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              {canSettle ? (
                <SettleUpDialog
                  selfMemberId={selfMemberId}
                  memberId={member.id}
                  memberName={member.name}
                  netCents={ownerNetCents}
                  groupId={groupId}
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="truncate">{children}</dd>
    </div>
  );
}

/** Balance figure, colored by direction: owed (green), owes (red), settled (muted). */
function BalanceValue({ netCents }: { netCents: number }) {
  if (netCents === 0) {
    return <Money cents={0} className="text-sm font-semibold text-muted-foreground" />;
  }
  return (
    <Money
      cents={Math.abs(netCents)}
      className={cn(
        'text-sm font-semibold',
        netCents > 0
          ? 'text-emerald-600 dark:text-emerald-500'
          : 'text-destructive',
      )}
    />
  );
}
