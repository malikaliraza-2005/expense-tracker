'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { Check, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { createGroup } from '@/actions/groups';
import { PersonSearch } from '@/components/members/person-search';
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
import type { Group, GroupType } from '@/types/db';
import { cn } from '@/utils/cn';
import type { Person } from '@/utils/people';

/**
 * Create a group with a name, a type, and (optionally) its people in one step — a
 * group is usable the moment it's created, no detour to the Members tab. The owner is
 * always a member of their own group, so they're not listed here.
 *
 * Two modes:
 *  - **Standalone** (default): renders its own "New group" trigger and, on success,
 *    refreshes the current route so the new group appears.
 *  - **Controlled / inline**: pass `open`/`onOpenChange` and an `onCreated` callback
 *    (and usually `showTrigger={false}`) to drive it from another surface — e.g. the
 *    expense form's "+ New group…" — and receive the created group instead of navigating.
 */
export function CreateGroupDialog({
  people = [],
  inviteRef,
  open: openProp,
  onOpenChange,
  showTrigger = true,
  onCreated,
}: {
  /** The owner's people available to add (the self-member is filtered out). */
  people?: Person[];
  inviteRef?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  /** When provided, called with the new group instead of refreshing the route. */
  onCreated?: (result: {
    group: Group;
    memberIds: string[];
    members: Person[];
  }) => void;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<GroupType>(DEFAULT_GROUP_TYPE);
  // People available to pick (grows as new ones are created inline), and who's chosen.
  const [roster, setRoster] = React.useState<Person[]>(() =>
    people.filter((person) => !person.isSelf),
  );
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [adding, setAdding] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  // Keep the roster in sync if the available people prop changes between opens.
  React.useEffect(() => {
    setRoster(people.filter((person) => !person.isSelf));
  }, [people]);

  function reset() {
    setName('');
    setType(DEFAULT_GROUP_TYPE);
    setSelected(new Set());
    setAdding(false);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addPerson(person: Person) {
    setRoster((prev) =>
      prev.some((p) => p.id === person.id) ? prev : [...prev, person],
    );
    setSelected((prev) => new Set(prev).add(person.id));
    setAdding(false);
  }

  function onCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Name is required.');
      return;
    }
    const memberIds = [...selected];
    const members = roster.filter((person) => selected.has(person.id));
    startTransition(async () => {
      const result = await createGroup({ name: trimmed, type, memberIds });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      reset();
      if (onCreated) {
        onCreated({ group: result.data, memberIds, members });
        return;
      }
      toast.success(`Created ${result.data.name}.`);
      // Stay on the list and let it re-render with the new group.
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      {showTrigger ? (
        <DialogTrigger asChild>
          <Button variant="gradient">
            <Plus />
            New group
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New group</DialogTitle>
          <DialogDescription>
            Group related expenses — a trip, a household, a team — and add the people
            splitting them.
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>People</Label>
              {!adding ? (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  disabled={isPending}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary outline-none transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add person
                </button>
              ) : null}
            </div>

            {adding ? (
              <PersonSearch
                people={roster}
                selectedIds={[...selected]}
                onAdd={addPerson}
                inviteRef={inviteRef}
                onClose={() => setAdding(false)}
                disabled={isPending}
                autoFocus
              />
            ) : null}

            {roster.length === 0 && !adding ? (
              <p className="text-sm text-muted-foreground">
                It&apos;s just you for now — add people with “Add person”, or later
                from the group.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {roster.map((person) => {
                  const isOn = selected.has(person.id);
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => toggle(person.id)}
                      disabled={isPending}
                      aria-pressed={isOn}
                      className={cn(
                        'inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring',
                        isOn
                          ? 'border-primary bg-primary/15 text-foreground shadow-glow-sm'
                          : 'border-border/60 bg-background/30 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors [&_svg]:h-3 [&_svg]:w-3',
                          isOn
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/50',
                        )}
                      >
                        {isOn ? <Check /> : null}
                      </span>
                      <span className="truncate">{person.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
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
