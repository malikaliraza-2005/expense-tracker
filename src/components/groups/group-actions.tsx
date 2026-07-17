'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { deleteGroup, renameGroup } from '@/actions/groups';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { GROUP_TYPES } from '@/constants/group-types';
import { ROUTES } from '@/constants/routes';
import type { GroupType } from '@/types/db';

/**
 * Rename / retype or delete a group, from an overflow menu. Delete confirms and
 * explains that the group's expenses are kept (moved to general), not deleted.
 */
export function GroupActions({
  groupId,
  groupName,
  groupType,
}: {
  groupId: string;
  groupName: string;
  groupType: GroupType;
}) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [name, setName] = React.useState(groupName);
  const [type, setType] = React.useState<GroupType>(groupType);
  const [isPending, startTransition] = React.useTransition();

  function onRename() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Name is required.');
      return;
    }
    startTransition(async () => {
      const result = await renameGroup({ groupId, name: trimmed, type });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Group updated.');
      setRenameOpen(false);
      router.refresh();
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteGroup({ groupId });
      if (!result.ok) {
        toast.error(result.error);
        setDeleteOpen(false);
        return;
      }
      toast.success(`Deleted ${groupName}.`);
      setDeleteOpen(false);
      router.push(ROUTES.groups);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${groupName}`}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:h-5 [&_svg]:w-5"
          >
            <MoreHorizontal />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="gap-2"
            onSelect={(event) => {
              event.preventDefault();
              setName(groupName);
              setType(groupType);
              setRenameOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2 text-destructive focus:text-destructive"
            onSelect={(event) => {
              event.preventDefault();
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit group</DialogTitle>
            <DialogDescription>Update the group name or type.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-rename">Name</Label>
              <Input
                id="group-rename"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isPending}
                autoFocus
                maxLength={60}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onRename();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-retype">Type</Label>
              <Select
                id="group-retype"
                value={type}
                onChange={(event) => setType(event.target.value as GroupType)}
                disabled={isPending}
              >
                {GROUP_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="gradient"
              onClick={onRename}
              disabled={isPending || !name.trim()}
            >
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {groupName}?</DialogTitle>
            <DialogDescription>
              The group is removed. Its expenses are kept and moved to your
              general (ungrouped) activity — nothing is lost. This cannot be
              undone.
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
              onClick={onDelete}
              disabled={isPending}
            >
              {isPending ? 'Deleting…' : 'Delete group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
