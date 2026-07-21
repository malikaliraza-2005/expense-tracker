'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { Loader2, UserMinus } from 'lucide-react';
import { toast } from 'sonner';

import { removeGroupMember } from '@/actions/groups';
import { Button } from '@/components/ui/button';

/**
 * Remove one person from a group — the explicit, obvious removal control on their
 * member card (the group owner never gets one; they're always in their own group).
 * Surfaces all three states: a spinner while the action runs, a success toast naming
 * who was removed, and an error toast that leaves them in place. The action also
 * notifies the removed person (activity), and realtime refreshes every affected
 * account, so no manual reload is needed anywhere.
 */
export function RemoveMemberButton({
  groupId,
  memberId,
  memberName,
}: {
  groupId: string;
  memberId: string;
  memberName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  function remove() {
    startTransition(async () => {
      const result = await removeGroupMember({ groupId, memberId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Removed ${memberName} from the group.`);
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 shrink-0 text-muted-foreground hover:text-destructive"
      disabled={isPending}
      onClick={remove}
      aria-label={`Remove ${memberName} from the group`}
    >
      {isPending ? <Loader2 className="animate-spin" /> : <UserMinus />}
      {isPending ? 'Removing…' : 'Remove'}
    </Button>
  );
}
