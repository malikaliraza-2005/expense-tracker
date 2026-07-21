'use client';

import * as React from 'react';

import { Check, Mail, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';

import { addMember } from '@/actions/members';
import { InviteByEmailDialog } from '@/components/members/invite-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/utils/cn';
import { findExisting, matchPeople, type Person } from '@/utils/people';

export interface PersonSearchProps {
  /** Candidate people to search — the owner's people available here. */
  people: Person[];
  /** Ids already chosen; shown as "added" and not re-addable. */
  selectedIds?: string[];
  /** Add an existing (picked) or newly-created person. */
  onAdd: (person: Person) => void;
  /**
   * Retained for call-site compatibility. Invites are now real email invites via
   * {@link InviteByEmailDialog}, so no referral hint is threaded through a URL.
   */
  inviteRef?: string;
  /** Renders a cancel (X) button that calls this. */
  onClose?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  /**
   * Suppress the built-in "invite this new person" banner so a parent can own
   * the prompt instead (e.g. the expense form's "add to friends?" flow, which
   * offers it for existing picks too). Defaults to showing the banner.
   */
  suppressInvitePrompt?: boolean;
}

/**
 * Search-as-you-type people picker. Finds the owner's existing people EMAIL-first
 * then by name (via {@link matchPeople}), each shown with their email so a
 * duplicate is obvious; click a result to add them. When nothing matches, it adds
 * a brand-new person (with an optional email) and offers a shareable link to
 * invite them to the app. Purely additive — it never edits or removes anyone and
 * knows nothing about how the chosen people are split.
 */
export function PersonSearch({
  people,
  selectedIds = [],
  onAdd,
  onClose,
  disabled,
  autoFocus,
  suppressInvitePrompt = false,
}: PersonSearchProps) {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [invited, setInvited] = React.useState<Person | null>(null);
  const [inviteOpen, setInviteOpen] = React.useState(false);

  const selected = React.useMemo(() => new Set(selectedIds), [selectedIds]);

  // Live matches for whatever's typed (email preferred), capped to a quick-pick.
  const results = React.useMemo(() => {
    const query = email.trim() || name.trim();
    return matchPeople(query, people).slice(0, 6);
  }, [name, email, people]);

  // The exact person this (name, email) would duplicate — select, never re-add.
  const existing = React.useMemo(
    () => findExisting(name, email, people),
    [name, email, people],
  );

  const trimmedName = name.trim();
  const canSubmit = Boolean(existing) || trimmedName.length > 0;

  function reset() {
    setName('');
    setEmail('');
  }

  function pick(person: Person) {
    if (!selected.has(person.id)) {
      onAdd(person);
      toast.success(`Added ${person.isSelf ? 'you' : person.name}.`);
    }
    reset();
  }

  /** Enter / the add button: select an exact match, else create a new person. */
  function submit() {
    if (existing) {
      pick(existing);
      return;
    }
    if (!trimmedName) return;
    setPending(true);
    addMember({ name: trimmedName, email: email.trim() }).then((result) => {
      setPending(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const person: Person = {
        id: result.data.id,
        name: result.data.name,
        email: result.data.email,
        isSelf: result.data.is_self,
      };
      onAdd(person);
      reset();
      // Brand-new person — offer to invite them to join the app, unless a parent
      // owns that prompt (e.g. the expense form's "add to friends?" flow).
      if (!suppressInvitePrompt) setInvited(person);
      toast.success(`Added ${person.name}.`);
    });
  }

  const busy = disabled || pending;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Search or add by name"
          disabled={busy}
          autoFocus={autoFocus}
          maxLength={60}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
            if (event.key === 'Escape' && onClose) {
              reset();
              onClose();
            }
          }}
        />
        <Button
          type="button"
          size="icon"
          variant="gradient"
          aria-label={existing ? 'Add person' : 'Add new person'}
          onClick={submit}
          disabled={busy || !canSubmit}
        >
          <UserPlus />
        </Button>
        {onClose ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Cancel"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={pending}
          >
            <X />
          </Button>
        ) : null}
      </div>

      <Input
        type="email"
        inputMode="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email (optional) — matches & invites them"
        disabled={busy}
        maxLength={200}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            submit();
          }
        }}
      />

      {/* Live matches from existing people, email-first, each with their email. */}
      {results.length > 0 ? (
        <ul className="overflow-hidden rounded-lg border border-border/60 bg-background/40">
          {results.map((person) => {
            const added = selected.has(person.id);
            return (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => pick(person)}
                  disabled={added || busy}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 px-3 py-2 text-left outline-none transition-colors focus-visible:bg-accent/50',
                    added ? 'cursor-default opacity-60' : 'hover:bg-accent/40',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {person.isSelf ? 'You' : person.name}
                    </span>
                    {person.email ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {person.email}
                      </span>
                    ) : null}
                  </span>
                  {added ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <Check className="h-3.5 w-3.5" />
                      Added
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs font-medium text-primary">
                      Add
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* No existing match — the typed name becomes a brand-new person. */}
      {trimmedName && !existing && results.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No match — “{trimmedName}” will be added as a new person.
        </p>
      ) : null}

      {invited ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/[0.04] px-3 py-2">
          <span className="min-w-0 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{invited.name}</span>{' '}
            isn&apos;t in the app yet — send them an email invite to join.
          </span>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary outline-none transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring [&_svg]:h-3.5 [&_svg]:w-3.5"
          >
            <Mail />
            Invite
          </button>
        </div>
      ) : null}

      {invited ? (
        <InviteByEmailDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          memberId={invited.id}
          memberName={invited.name}
          defaultEmail={invited.email}
        />
      ) : null}
    </div>
  );
}
