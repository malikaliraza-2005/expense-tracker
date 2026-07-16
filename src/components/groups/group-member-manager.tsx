'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { Check, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';

import { addGroupMember, removeGroupMember } from '@/actions/groups';
import { PersonSearch } from '@/components/members/person-search';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/utils/cn';
import { matchPeople, type Person } from '@/utils/people';

/** A member the owner can add to the group. */
export interface ManageableMember {
  id: string;
  name: string;
  isSelf: boolean;
  email: string | null;
}

/**
 * Toggle which of the owner's people belong to a group. Each chip reflects
 * current membership and shows the person's email; clicking adds or removes them
 * via the group actions and refreshes so balances and the ledger re-derive. A
 * search filters the chips EMAIL-first then by name, and "Add person" opens the
 * shared {@link PersonSearch} to add someone new (with an invite link when they
 * aren't in the app yet). Group membership only — never changes how expenses
 * are split.
 */
export function GroupMemberManager({
  groupId,
  allMembers,
  memberIds,
  inviteRef,
}: {
  groupId: string;
  allMembers: ManageableMember[];
  memberIds: string[];
  inviteRef?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [, startTransition] = React.useTransition();

  // Optimistic membership: chips flip the instant a toggle starts, then the
  // Server Action + router.refresh() reconcile the real state (and the derived
  // balances on the other tabs). If the action fails we surface it and the
  // optimistic value reverts when the transition ends.
  const [optimisticIds, setOptimisticIds] = React.useOptimistic(
    memberIds,
    (state: string[], change: { id: string; add: boolean }) =>
      change.add
        ? state.includes(change.id)
          ? state
          : [...state, change.id]
        : state.filter((id) => id !== change.id),
  );
  const current = React.useMemo(() => new Set(optimisticIds), [optimisticIds]);

  const filtered = React.useMemo(
    () => matchPeople(query, allMembers),
    [query, allMembers],
  );

  function toggle(member: ManageableMember) {
    const inGroup = current.has(member.id);
    startTransition(async () => {
      setOptimisticIds({ id: member.id, add: !inGroup });
      const result = inGroup
        ? await removeGroupMember({ groupId, memberId: member.id })
        : await addGroupMember({ groupId, memberId: member.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  // From the "Add person" search: add the chosen (or newly created) person to
  // this group if they aren't already in it, then refresh.
  function addToGroup(person: Person) {
    if (current.has(person.id)) {
      setAdding(false);
      return;
    }
    startTransition(async () => {
      setOptimisticIds({ id: person.id, add: true });
      const result = await addGroupMember({ groupId, memberId: person.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setAdding(false);
      router.refresh();
    });
  }

  if (allMembers.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Add someone to your people, then add them to this group.
        </p>
        <PersonSearch
          people={allMembers}
          onAdd={addToGroup}
          inviteRef={inviteRef}
          autoFocus={false}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people by name or email"
            aria-label="Search people"
            className="pl-9"
          />
        </div>
        {!adding ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setAdding(true)}
          >
            <Plus />
            Add person
          </Button>
        ) : null}
      </div>

      {adding ? (
        <PersonSearch
          people={allMembers}
          selectedIds={memberIds}
          onAdd={addToGroup}
          inviteRef={inviteRef}
          onClose={() => setAdding(false)}
          autoFocus
        />
      ) : null}

      {filtered.length === 0 ? (
        <p className="px-1 py-4 text-sm text-muted-foreground">
          No one matches “{query}”. Use “Add person” to add them.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {filtered.map((member) => {
            const inGroup = current.has(member.id);
            const label = member.isSelf ? 'You' : member.name;
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => toggle(member)}
                aria-pressed={inGroup}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
                  inGroup
                    ? 'border-primary bg-primary/15 text-foreground shadow-glow-sm'
                    : 'border-border/60 bg-background/30 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors [&_svg]:h-3 [&_svg]:w-3',
                    inGroup
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/50',
                  )}
                >
                  {inGroup ? <Check /> : null}
                </span>
                <span className="flex min-w-0 flex-col items-start leading-tight">
                  <span className="truncate">{label}</span>
                  {!member.isSelf && member.email ? (
                    <span className="max-w-[12rem] truncate text-[11px] font-normal text-muted-foreground">
                      {member.email}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
