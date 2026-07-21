'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { Mail, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

import { openDmThread } from '@/actions/dm';
import { InviteByEmailDialog } from '@/components/members/invite-dialog';
import { SettleUpDialog } from '@/components/settlements/settlement-controls';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import type { FriendStatus } from '@/lib/friends';

/**
 * The per-friend action cluster on the Friends page. A friend who's on the app (linked
 * to a real account) gets a **Message** button that opens — or reuses — the one shared
 * DM thread with them and navigates into it. A not-yet-invited friend (has an email but
 * no live invite and no linked account) gets an **Invite** button that opens the shared
 * {@link InviteByEmailDialog}; any friend with a live balance gets a **Settle up**. All
 * are client controls, so they live here rather than in the Server Component list.
 * `selfMemberId` is null only before the owner's self-member exists, which disables
 * settle-up as a backstop. `linkedUserId` is the friend's account id (present only when
 * linked), the target of {@link openDmThread}.
 */
export function FriendRowActions({
  status,
  selfMemberId,
  memberId,
  memberName,
  email,
  netCents,
  linkedUserId,
}: {
  status: FriendStatus;
  selfMemberId: string | null;
  memberId: string;
  memberName: string;
  email: string | null;
  /** The owner's net with this friend: > 0 they owe you, < 0 you owe them. */
  netCents: number;
  /** The friend's linked account id, or null when they're not on the app yet. */
  linkedUserId: string | null;
}) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const canSettle = Boolean(selfMemberId) && netCents !== 0;
  // Only accounts on the app can be DM'd; a name-only or merely-invited friend can't.
  const canMessage = status === 'linked' && Boolean(linkedUserId);

  function message() {
    if (!linkedUserId || isPending) return;
    startTransition(async () => {
      const res = await openDmThread({ otherUserId: linkedUserId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.push(`${ROUTES.messageThread}/${res.data.threadId}`);
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {canMessage ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          onClick={message}
          disabled={isPending}
        >
          <MessageCircle />
          {isPending ? 'Opening…' : 'Message'}
        </Button>
      ) : null}

      {status === 'not_invited' ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
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
          className="h-9"
        />
      ) : null}
    </div>
  );
}
