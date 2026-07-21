'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { Check, Loader2, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';

import { addGroupMember } from '@/actions/groups';
import { PersonSearch } from '@/components/members/person-search';
import { Avatar } from '@/components/ui/avatar';
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
 * Add people to a group. This section is **add-only** — each of the owner's people is
 * a chip that either reads *Added* (already in the group, not actionable) or is
 * clickable to add, so existing members, the one being added, and search results are
 * visually distinct. Removing happens on the member cards below, where it's explicit.
 * The group owner is never listed here: they always belong to their own group.
 *
 * Every add shows its own states — a spinner on the chip while it runs, a success
 * toast, or an error toast that reverts the optimistic chip. A search filters
 * EMAIL-first then by name, and "Add person" opens the shared {@link PersonSearch} to
 * add someone new (with an invite link when they aren't in the app yet). Group
 * membership only — never changes how expenses are split.
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
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  // Optimistic membership: a chip flips to "Added" the instant the add starts, then
  // the Server Action + router.refresh() reconcile the real state (and the derived
  // balances on the other tabs). On failure the optimistic value reverts.
  const [optimisticIds, setOptimisticIds] = React.useOptimistic(
    memberIds,
    (state: string[], id: string) => (state.includes(id) ? state : [...state, id]),
  );
  const current = React.useMemo(() => new Set(optimisticIds), [optimisticIds]);

  const filtered = React.useMemo(
    () => matchPeople(query, allMembers),
    [query, allMembers],
  );

  function add(member: { id: string; name: string }) {
    if (current.has(member.id)) return;
    setPendingId(member.id);
    startTransition(async () => {
      setOptimisticIds(member.id);
      const result = await addGroupMember({ groupId, memberId: member.id });
      setPendingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Added ${member.name} to the group.`);
      router.refresh();
    });
  }

  // From the "Add person" search: add the chosen (or newly created) person.
  function addFromSearch(person: Person) {
    setAdding(false);
    if (current.has(person.id)) return;
    add({ id: person.id, name: person.name });
  }

  if (allMembers.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Add someone to your people, then add them to this group.
        </p>
        <PersonSearch
          people={allMembers}
          onAdd={addFromSearch}
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
          onAdd={addFromSearch}
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
            const isPending = pendingId === member.id;
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => add(member)}
                disabled={inGroup || isPending}
                aria-label={
                  inGroup
                    ? `${member.name} is already in the group`
                    : `Add ${member.name} to the group`
                }
                className={cn(
                  'inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-3 py-2 text-left text-sm font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring',
                  inGroup
                    ? 'cursor-default border-primary/40 bg-primary/10 text-foreground'
                    : 'border-border/60 bg-background/30 text-foreground hover:border-primary/50 hover:bg-accent/40',
                  isPending && 'opacity-70',
                )}
              >
                <Avatar name={member.name} className="h-6 w-6 shrink-0 text-[10px]" />
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate" title={member.name}>
                    {member.name}
                  </span>
                  {member.email ? (
                    <span
                      className="truncate text-xs font-normal text-muted-foreground"
                      title={member.email}
                    >
                      {member.email}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    'ml-1 inline-flex shrink-0 items-center gap-1 text-xs font-semibold',
                    inGroup ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Adding…
                    </>
                  ) : inGroup ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Added
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
