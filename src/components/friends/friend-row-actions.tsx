'use client';

import * as React from 'react';

import { Mail } from 'lucide-react';

import { InviteByEmailDialog } from '@/components/members/invite-dialog';
import { SettleUpDialog } from '@/components/settlements/settlement-controls';
import { Button } from '@/components/ui/button';
import type { FriendStatus } from '@/lib/friends';

/**
 * The per-friend action cluster on the Friends page. A not-yet-invited friend (has
 * an email but no live invite and no linked account) gets an **Invite** button that
 * opens the shared {@link InviteByEmailDialog}; any friend with a live balance gets
 * a **Settle up**. Both are client controls, so they live here rather than in the
 * Server Component list. `selfMemberId` is null only before the owner's self-member
 * exists, which disables settle-up as a backstop.
 */
export function FriendRowActions({
  status,
  selfMemberId,
  memberId,
  memberName,
  email,
  netCents,
}: {
  status: FriendStatus;
  selfMemberId: string | null;
  memberId: string;
  memberName: string;
  email: string | null;
  /** The owner's net with this friend: > 0 they owe you, < 0 you owe them. */
  netCents: number;
}) {
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const canSettle = Boolean(selfMemberId) && netCents !== 0;

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {status === 'not_invited' ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setInviteOpen(true)}
          >
            <Mail />
            Invite
          </Button>
          <InviteByEmailDialog
            open={inviteOpen}
            onOpenChange={setInviteOpen}
            memberId={memberId}
            memberName={memberName}
            defaultEmail={email}
          />
        </>
      ) : null}

      {canSettle ? (
        <SettleUpDialog
          selfMemberId={selfMemberId as string}
          memberId={memberId}
          memberName={memberName}
          netCents={netCents}
          className="h-8"
        />
      ) : null}
    </div>
  );
}
