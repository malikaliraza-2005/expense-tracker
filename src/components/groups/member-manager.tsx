'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { addGroupMember, removeGroupMember } from '@/actions/groups';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import type { GroupFormFriend } from '@/components/groups/group-form';
import type { GroupMemberProfile } from '@/types/dto';

/**
 * Group membership manager (Client Component). Lists members and, for the owner,
 * provides add (from the owner's friends who are not yet members) and remove
 * controls via the `addGroupMember` / `removeGroupMember` actions. Non-owners see
 * a read-only roster. The owner row cannot be removed.
 */
export function MemberManager({
  groupId,
  ownerId,
  members,
  candidates,
  isOwner,
}: {
  groupId: string;
  ownerId: string;
  members: GroupMemberProfile[];
  candidates: GroupFormFriend[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState('');
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  function onAdd() {
    if (!selected) return;
    setPendingId('add');
    startTransition(async () => {
      const result = await addGroupMember({ groupId, userId: selected });
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Member added.');
      setSelected('');
      router.refresh();
    });
  }

  function onRemove(userId: string, name: string) {
    setPendingId(userId);
    startTransition(async () => {
      const result = await removeGroupMember({ groupId, userId });
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Removed ${name}.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {isOwner && candidates.length > 0 ? (
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <label htmlFor="add-member" className="text-sm font-medium">
              Add a friend to this group
            </label>
            <Select
              id="add-member"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              disabled={isPending}
            >
              <option value="">Select a friend…</option>
              {candidates.map((friend) => (
                <option key={friend.id} value={friend.id}>
                  {friend.name}
                </option>
              ))}
            </Select>
          </div>
          <Button
            type="button"
            onClick={onAdd}
            disabled={isPending || !selected}
          >
            <UserPlus />
            Add
          </Button>
        </div>
      ) : null}

      {isOwner && candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          All of your friends are already in this group. Add more friends to
          invite them here.
        </p>
      ) : null}

      <ul className="space-y-2">
        {members.map((member) => {
          const name = member.profile.full_name || 'Unnamed';
          const isGroupOwner = member.userId === ownerId;
          const canRemove = isOwner && !isGroupOwner;
          return (
            <li key={member.userId}>
              <Card className="flex items-center justify-between gap-3 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    name={member.profile.full_name}
                    src={member.profile.avatar_url}
                  />
                  <p className="truncate font-medium">{name}</p>
                  {isGroupOwner ? (
                    <Badge variant="secondary">Owner</Badge>
                  ) : null}
                </div>
                {canRemove ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${name}`}
                    disabled={isPending && pendingId === member.userId}
                    onClick={() => onRemove(member.userId, name)}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
