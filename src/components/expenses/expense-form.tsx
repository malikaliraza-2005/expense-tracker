'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { Check, Plus, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';

import { addMember } from '@/actions/members';
import { createExpense, updateExpense } from '@/actions/expenses';
import { AutoDateTime } from '@/components/expenses/auto-datetime';
import { CategorySelect } from '@/components/expenses/category-select';
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

/** A member available to pay or share within the chosen scope. */
export interface ScopeMember {
  id: string;
  name: string;
  isSelf: boolean;
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
  initial,
}: ExpenseFormProps) {
  const router = useRouter();
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [isPending, startTransition] = React.useTransition();

  // Everyone the expense can involve. Seeded from the (single) scope's members
  // and grown as people are added inline.
  const seed = scopes[0]?.members ?? [];
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

  // Inline "add person" state.
  const [adding, setAdding] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [addPending, setAddPending] = React.useState(false);

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

  function onAddPerson() {
    const name = newName.trim();
    if (!name) return;
    setAddPending(true);
    startTransition(async () => {
      const result = await addMember({ name });
      setAddPending(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const member: ScopeMember = {
        id: result.data.id,
        name: result.data.name,
        isSelf: result.data.is_self,
      };
      setRoster((prev) => [...prev, member]);
      setSelected((prev) => new Set(prev).add(member.id));
      setNewName('');
      setAdding(false);
      toast.success(`Added ${member.name}.`);
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: CreateExpenseFormInput = {
      groupId: null,
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
          <div className="flex items-center gap-2">
            <Input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Name of person to split with"
              disabled={addPending}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onAddPerson();
                }
                if (event.key === 'Escape') {
                  setAdding(false);
                  setNewName('');
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              variant="gradient"
              aria-label="Save person"
              onClick={onAddPerson}
              disabled={addPending || !newName.trim()}
            >
              <UserPlus />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Cancel"
              onClick={() => {
                setAdding(false);
                setNewName('');
              }}
              disabled={addPending}
            >
              <X />
            </Button>
          </div>
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
                      'inline-flex h-4 w-4 items-center justify-center rounded-full border transition-colors [&_svg]:h-3 [&_svg]:w-3',
                      isOn
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/50',
                    )}
                  >
                    {isOn ? <Check /> : null}
                  </span>
                  {memberLabel(member)}
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
