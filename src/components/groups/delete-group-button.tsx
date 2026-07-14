'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { deleteGroup } from '@/actions/groups';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ROUTES } from '@/constants/routes';

/**
 * Owner-only delete-group control with a confirmation dialog. The `deleteGroup`
 * action blocks deletion while the group has expenses; that error surfaces as a
 * toast. On success the user is returned to the groups list.
 */
export function DeleteGroupButton({
  groupId,
  groupName,
}: {
  groupId: string;
  groupName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  function onConfirm() {
    startTransition(async () => {
      const result = await deleteGroup({ groupId });
      if (!result.ok) {
        toast.error(result.error);
        setOpen(false);
        return;
      }
      toast.success('Group deleted.');
      router.push(ROUTES.groups);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash2 />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{groupName}”?</DialogTitle>
          <DialogDescription>
            This cannot be undone. A group that still has expenses cannot be
            deleted — clear or settle them first.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Deleting…' : 'Delete group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
