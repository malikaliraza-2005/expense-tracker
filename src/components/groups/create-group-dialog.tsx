'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { createGroup } from '@/actions/groups';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { DEFAULT_GROUP_TYPE, GROUP_TYPES } from '@/constants/group-types';
import type { GroupType } from '@/types/db';

/** Create a group (name + type) and return to the list; the user opens it when ready. */
export function CreateGroupDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<GroupType>(DEFAULT_GROUP_TYPE);
  const [isPending, startTransition] = React.useTransition();

  function onCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Name is required.');
      return;
    }
    startTransition(async () => {
      const result = await createGroup({ name: trimmed, type });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Created ${result.data.name}. Open it to add people.`);
      setOpen(false);
      setName('');
      setType(DEFAULT_GROUP_TYPE);
      // Stay on the list and let it re-render with the new group — the user
      // chooses when to open it (rather than being jumped into it).
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gradient">
          <Plus />
          New group
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New group</DialogTitle>
          <DialogDescription>
            Group related expenses — a trip, a household, a team. Open the group
            from the list to add people.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Hunza Trip"
              disabled={isPending}
              autoFocus
              maxLength={60}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onCreate();
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="group-type">Type</Label>
            <Select
              id="group-type"
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
            onClick={onCreate}
            disabled={isPending || !name.trim()}
          >
            {isPending ? 'Creating…' : 'Create group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
