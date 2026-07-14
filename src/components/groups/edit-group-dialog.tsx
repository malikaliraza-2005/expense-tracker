'use client';

import * as React from 'react';

import { Pencil } from 'lucide-react';

import { GroupForm } from '@/components/groups/group-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { GroupType } from '@/types/db';

/**
 * Owner-only edit-group dialog. Wraps the shared `GroupForm` in edit mode and
 * closes itself on a successful save (documented as a dialog in phase-3 §4).
 */
export function EditGroupDialog({
  group,
}: {
  group: { id: string; name: string; type: GroupType };
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit group</DialogTitle>
        </DialogHeader>
        <GroupForm
          mode="edit"
          initial={{ groupId: group.id, name: group.name, type: group.type }}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
