'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { toast } from 'sonner';

import { createGroup, updateGroup } from '@/actions/groups';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { DEFAULT_GROUP_TYPE, GROUP_TYPES } from '@/constants/group-types';
import {
  validateCreateGroup,
  validateUpdateGroup,
} from '@/schemas/group.schema';
import type { GroupType } from '@/types/db';

export interface GroupFormFriend {
  id: string;
  name: string;
}

type FieldErrors = { name?: string; type?: string };

interface GroupFormProps {
  mode: 'create' | 'edit';
  /** Selectable friends for optional membership (create mode only). */
  friends?: GroupFormFriend[];
  /** Existing values (edit mode). */
  initial?: { groupId: string; name: string; type: GroupType };
  /** Called after a successful write (e.g. to close a dialog). */
  onSuccess?: () => void;
}

/**
 * Create / edit group form (Client Component). Shared validation drives inline
 * field errors; the `createGroup` / `updateGroup` Server Actions perform the
 * write. On create it navigates to the new group; on edit it refreshes and
 * invokes `onSuccess`. Member selection (create) is limited to the user's
 * friends, matching the server-side rule.
 */
export function GroupForm({
  mode,
  friends = [],
  initial,
  onSuccess,
}: GroupFormProps) {
  const router = useRouter();
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [isPending, startTransition] = React.useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('name') ?? '');
    const type = String(formData.get('type') ?? '');

    if (mode === 'edit') {
      const parsed = validateUpdateGroup({
        groupId: initial?.groupId,
        name,
        type,
      });
      if (!parsed.success) {
        setErrors(parsed.errors);
        return;
      }
      setErrors({});
      startTransition(async () => {
        const result = await updateGroup(parsed.data);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success('Group updated.');
        router.refresh();
        onSuccess?.();
      });
      return;
    }

    const memberIds = formData.getAll('memberIds').map((value) => String(value));
    const parsed = validateCreateGroup({ name, type, memberIds });
    if (!parsed.success) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await createGroup(parsed.data);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Group created.');
      onSuccess?.();
      router.push(`/groups/${result.data.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="group-name">Name</Label>
        <Input
          id="group-name"
          name="name"
          type="text"
          defaultValue={initial?.name ?? ''}
          placeholder="e.g. Summer Trip"
          aria-invalid={Boolean(errors.name)}
          disabled={isPending}
          autoFocus
        />
        {errors.name ? (
          <p className="text-sm text-destructive">{errors.name}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="group-type">Type</Label>
        <Select
          id="group-type"
          name="type"
          defaultValue={initial?.type ?? DEFAULT_GROUP_TYPE}
          aria-invalid={Boolean(errors.type)}
          disabled={isPending}
        >
          {GROUP_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        {errors.type ? (
          <p className="text-sm text-destructive">{errors.type}</p>
        ) : null}
      </div>

      {mode === 'create' && friends.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Add members (optional)</legend>
          <div className="space-y-2 rounded-md border p-3">
            {friends.map((friend) => (
              <label
                key={friend.id}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="memberIds"
                  value={friend.id}
                  disabled={isPending}
                  className="h-4 w-4 rounded border-input"
                />
                {friend.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending
          ? mode === 'edit'
            ? 'Saving…'
            : 'Creating…'
          : mode === 'edit'
            ? 'Save changes'
            : 'Create group'}
      </Button>
    </form>
  );
}
