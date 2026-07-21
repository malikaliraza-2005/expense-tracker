'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { Check, X } from 'lucide-react';
import { toast } from 'sonner';

import { acceptInvite, rejectInvite } from '@/actions/invite';
import { Button } from '@/components/ui/button';

/**
 * Accept / Decline for a received, still-actionable request. Accept links the
 * accounts (and, for a friend request, creates the reciprocal member so both
 * rosters show the friendship — migration 0016); Decline flips it to rejected.
 * Both refresh in place — unlike the invite landing page, we stay on Requests
 * rather than following the invite's landing route — so the tabs and nav badge
 * update together.
 */
export function RequestActions({
  token,
  name,
}: {
  token: string;
  name: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  function decide(action: 'accept' | 'reject') {
    startTransition(async () => {
      const res =
        action === 'accept'
          ? await acceptInvite(token)
          : await rejectInvite(token);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        action === 'accept'
          ? `You’re now friends with ${name}.`
          : `Declined ${name}’s request.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9"
        disabled={isPending}
        onClick={() => decide('reject')}
      >
        <X />
        Decline
      </Button>
      <Button
        type="button"
        variant="gradient"
        size="sm"
        className="h-9"
        disabled={isPending}
        onClick={() => decide('accept')}
      >
        <Check />
        Accept
      </Button>
    </div>
  );
}
