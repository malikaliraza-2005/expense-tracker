'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { Check, Plus, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';

import { createExpense, updateExpense } from '@/actions/expenses';
import { AutoDateTime } from '@/components/expenses/auto-datetime';
import { CategorySelect } from '@/components/expenses/category-select';
import { InviteByEmailDialog } from '@/components/members/invite-dialog';
import { PersonSearch } from '@/components/members/person-search';
import { useCurrency } from '@/components/providers/currency-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  validateCreateExpense,
  validateUpdateExpense,
  type CreateExpenseFormInput,
} from '@/schemas/expense.schema';
import type { Category } from '@/types/db';
import { cn } from '@/utils/cn';
import { toISODate } from '@/utils/date';
import { parseAmountToCents } from '@/utils/money';
import type { Person } from '@/utils/people';

/** A member available to pay or share within the chosen scope. */
export interface ScopeMember {
  id: string;
  name: string;
  isSelf: boolean;
  email: string | null;
}

/** A scope the expense can belong to: general (`id: null`) or a group. */
export interface ExpenseScope {
  id: string | null;
  label: string;
  members: ScopeMember[];
}

/** Existing values for edit mode. */
export interface ExpenseFormInitial {
  expenseId: string;
  groupId: string | null;
  title: string;
  amountCents: number;
  categoryId: number;
  expenseDate: string;
  paidBy: string;
  notes: string | null;
  memberIds: string[];
}

type FieldErrors = {
  title?: string;
  amountCents?: string;
  categoryId?: string;
  expenseDate?: string;
  paidBy?: string;
  memberIds?: string;
};

interface ExpenseFormProps {
  mode: 'create' | 'edit';
  categories: Category[];
  scopes: ExpenseScope[];
  selfMemberId: string | null;
  /** ISO `yyyy-mm-dd` default for the date field (create). */
  defaultDate: string;
  /** Pre-selected group scope on create (from `?group=`); ignored in edit. */
  defaultGroupId?: string | null;
  /** Current owner's id, used to tag the invite link with a referral hint. */
  userId?: string;
  initial?: ExpenseFormInitial;
}

function centsToInput(amountCents: number): string {
  return amountCents > 0 ? String(amountCents / 100) : '';
}

/**
 * Add / edit expense form (Client Component). Optimised for the fewest taps:
 * amount → description → category → who paid → who shared → save. People you
 * split with are your members; new people can be added inline (the + next to
 * "Paid by") without leaving the form. The split is always EQUAL and previewed
 * live. On success it navigates to the expense.
 */
export function ExpenseForm({
  mode,
  categories,
  scopes,
  selfMemberId,
  defaultDate,
  defaultGroupId,
  userId,
  initial,
}: ExpenseFormProps) {
  const router = useRouter();
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [isPending, startTransition] = React.useTransition();

  // Which scope (general or a group) the expense belongs to. Edit uses the saved
  // group; create can be pre-pointed at a group via `?group=`. The scope decides
  // both the expense's group_id and who can pay / share.
  const initialScopeId = initial ? initial.groupId : (defaultGroupId ?? null);
  const [scopeId, setScopeId] = React.useState<string | null>(initialScopeId);
  const initialScope =
    scopes.find((s) => s.id === initialScopeId) ?? scopes[0];
  const isGeneral = scopeId === null;

  // Everyone the expense can involve — the current scope's members, grown as
  // people are added inline (general scope only).
  const seed = initialScope?.members ?? [];
  const [roster, setRoster] = React.useState<ScopeMember[]>(seed);

  const [title, setTitle] = React.useState(initial?.title ?? '');
  const [amount, setAmount] = React.useState(
    initial ? centsToInput(initial.amountCents) : '',
  );
  const [categoryId, setCategoryId] = React.useState<number | ''>(
    initial?.categoryId ?? categories[0]?.id ?? '',
  );
  const [expenseDate, setExpenseDate] = React.useState(
    initial?.expenseDate ?? defaultDate,
  );
  const [note, setNote] = React.useState(initial?.notes ?? '');

  const [payer, setPayer] = React.useState(
    initial?.paidBy ?? selfMemberId ?? seed[0]?.id ?? '',
  );

  // Selected participants. Default: everyone (create) or the saved set (edit).
  const [selected, setSelected] = React.useState<Set<string>>(() => {
    if (initial) return new Set(initial.memberIds);
    return new Set(seed.map((m) => m.id));
  });

  // Whether the inline person search is open.
  const [adding, setAdding] = React.useState(false);

  // The person just added to the split we're offering to make a friend, plus
  // whether the invite dialog is open. Cleared when dismissed.
  const [friendPrompt, setFriendPrompt] = React.useState<ScopeMember | null>(
    null,
  );
  const [friendDialogOpen, setFriendDialogOpen] = React.useState(false);

  const { format, symbol } = useCurrency();

  // For a new expense, snap the date to the viewer's LOCAL today (the server
  // default can be a day off across timezones). Runs once on mount.
  React.useEffect(() => {
    if (mode === 'create' && !initial) setExpenseDate(toISODate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const amountCents = parseAmountToCents(amount);
  const participantIds = roster
    .filter((m) => selected.has(m.id))
    .map((m) => m.id);
  const perPersonCents =
    participantIds.length > 0
      ? Math.floor(amountCents / participantIds.length)
      : 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Switch scope: swap the roster to the new scope's members, select them all,
  // and keep the payer only if they're still available.
  function changeScope(value: string) {
    const id = value === '' ? null : value;
    const scope = scopes.find((s) => s.id === id) ?? scopes[0];
    const scopeMembers = scope?.members ?? [];
    setScopeId(id);
    setRoster(scopeMembers);
    setSelected(new Set(scopeMembers.map((m) => m.id)));
    setPayer((prev) => {
      if (scopeMembers.some((m) => m.id === prev)) return prev;
      if (selfMemberId && scopeMembers.some((m) => m.id === selfMemberId)) {
        return selfMemberId;
      }
      return scopeMembers[0]?.id ?? '';
    });
    setAdding(false);
  }

  // Add a person to the split — whether picked from the search results or just
  // created. New people also join the roster; everyone gets selected. Deduped by
  // id, so re-adding someone already present is a no-op beyond selecting them.
  function addToSplit(person: Person) {
    const member: ScopeMember = {
      id: person.id,
      name: person.name,
      isSelf: person.isSelf ?? false,
      email: person.email,
    };
    setRoster((prev) =>
      prev.some((m) => m.id === member.id) ? prev : [...prev, member],
    );
    setSelected((prev) => new Set(prev).add(member.id));
    // Offer to also make this person a friend (an email invite that links their
    // account). Not for yourself — you're already the account.
    if (!member.isSelf) setFriendPrompt(member);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: CreateExpenseFormInput = {
      groupId: scopeId,
      title,
      description: null,
      amountCents,
      categoryId: categoryId === '' ? undefined : categoryId,
      expenseDate,
      paidBy: payer,
      notes: note,
      memberIds: participantIds,
    };

    if (mode === 'edit') {
      const parsed = validateUpdateExpense({
        ...payload,
        expenseId: initial?.expenseId,
      });
      if (!parsed.success) {
        setErrors(parsed.errors);
        return;
      }
      setErrors({});
      startTransition(async () => {
        const result = await updateExpense(parsed.data);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success('Expense updated.');
        router.push(`/expenses/${result.data.id}`);
        router.refresh();
      });
      return;
    }

    const parsed = validateCreateExpense(payload);
    if (!parsed.success) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await createExpense(parsed.data);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Expense added.');
      router.push(`/expenses/${result.data.id}`);
      router.refresh();
    });
  }

  const memberLabel = (m: ScopeMember) => (m.isSelf ? 'You' : m.name);

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {scopes.length > 1 ? (
        <div className="space-y-2">
          <Label htmlFor="expense-scope">Group</Label>
          <Select
            id="expense-scope"
            value={scopeId ?? ''}
            onChange={(event) => changeScope(event.target.value)}
            disabled={isPending}
          >
            {scopes.map((scope) => (
              <option key={scope.id ?? 'general'} value={scope.id ?? ''}>
                {scope.label}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="expense-amount">Amount</Label>
        <div
          className={cn(
            'flex h-14 items-center rounded-lg border border-input bg-background/60 pl-4 pr-2 shadow-inner-top backdrop-blur-sm transition-all duration-200 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-ring/40',
            errors.amountCents &&
              'border-destructive focus-within:ring-destructive/40',
          )}
        >
          <span className="select-none text-2xl font-semibold text-muted-foreground">
            {symbol}
          </span>
          <input
            id="expense-amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            aria-invalid={Boolean(errors.amountCents)}
            disabled={isPending}
            autoFocus
            className="h-full w-full flex-1 bg-transparent pl-2 text-2xl font-semibold tabular-nums outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        {errors.amountCents ? (
          <p className="text-sm text-destructive">{errors.amountCents}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="expense-title">Description</Label>
        <Input
          id="expense-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Dinner"
          aria-invalid={Boolean(errors.title)}
          disabled={isPending}
        />
        {errors.title ? (
          <p className="text-sm text-destructive">{errors.title}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CategorySelect
          categories={categories}
          value={categoryId}
          onChange={setCategoryId}
          disabled={isPending}
          error={errors.categoryId}
        />
        <div className="space-y-2">
          <Label>Date</Label>
          <AutoDateTime value={expenseDate} live={mode === 'create'} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="expense-payer">Paid by</Label>
          {isGeneral && !adding ? (
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

        {isGeneral && adding ? (
          <PersonSearch
            people={roster}
            selectedIds={participantIds}
            onAdd={addToSplit}
            inviteRef={userId}
            onClose={() => setAdding(false)}
            disabled={isPending}
            autoFocus
            suppressInvitePrompt
          />
        ) : null}

        {/* After adding someone, offer to also add them to your friends. */}
        {friendPrompt ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/[0.04] px-3 py-2">
            <span className="min-w-0 text-xs text-muted-foreground">
              Add{' '}
              <span className="font-medium text-foreground">
                {friendPrompt.name}
              </span>{' '}
              to your friends? Invite them so they can see the split and settle
              up.
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setFriendDialogOpen(true)}
                disabled={isPending}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary outline-none transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring [&_svg]:h-3.5 [&_svg]:w-3.5"
              >
                <UserPlus />
                Add friend
              </button>
              <button
                type="button"
                onClick={() => setFriendPrompt(null)}
                aria-label="Dismiss"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:h-3.5 [&_svg]:w-3.5"
              >
                <X />
              </button>
            </div>
          </div>
        ) : null}

        {friendPrompt ? (
          <InviteByEmailDialog
            open={friendDialogOpen}
            onOpenChange={(open) => {
              setFriendDialogOpen(open);
              // Retire the prompt once the dialog is dismissed either way.
              if (!open) setFriendPrompt(null);
            }}
            memberId={friendPrompt.id}
            memberName={friendPrompt.name}
            defaultEmail={friendPrompt.email}
          />
        ) : null}

        <Select
          id="expense-payer"
          value={payer}
          onChange={(event) => setPayer(event.target.value)}
          disabled={isPending}
        >
          {roster.length === 0 ? (
            <option value="">Add someone first</option>
          ) : null}
          {roster.map((member) => (
            <option key={member.id} value={member.id}>
              {memberLabel(member)}
            </option>
          ))}
        </Select>
        {errors.paidBy ? (
          <p className="text-sm text-destructive">{errors.paidBy}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Split between</Label>
          {participantIds.length > 0 && amountCents > 0 ? (
            <span className="text-sm text-muted-foreground tabular-nums">
              {format(perPersonCents)} each
            </span>
          ) : null}
        </div>
        {roster.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add the people you want to split this with using “Add person”.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {roster.map((member) => {
              const isOn = selected.has(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggle(member.id)}
                  disabled={isPending}
                  aria-pressed={isOn}
                  className={cn(
                    'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring',
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
                  <span className="flex min-w-0 flex-col items-start leading-tight">
                    <span className="truncate">{memberLabel(member)}</span>
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
        {errors.memberIds ? (
          <p className="text-sm text-destructive">{errors.memberIds}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="expense-note">Note (optional)</Label>
        <Input
          id="expense-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Anything worth remembering"
          disabled={isPending}
        />
      </div>

      <Button
        type="submit"
        size="lg"
        variant="gradient"
        className="w-full"
        disabled={isPending || participantIds.length === 0}
      >
        {isPending
          ? mode === 'edit'
            ? 'Saving…'
            : 'Adding…'
          : mode === 'edit'
            ? 'Save changes'
            : 'Add expense'}
      </Button>
    </form>
  );
}
