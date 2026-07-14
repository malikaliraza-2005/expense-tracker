'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { toast } from 'sonner';

import { createExpense, updateExpense } from '@/actions/expenses';
import { CategorySelect } from '@/components/expenses/category-select';
import { PayerSelect, type Person } from '@/components/expenses/payer-select';
import {
  SplitEditor,
  type SplitEditorValue,
} from '@/components/expenses/split-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  validateCreateExpense,
  validateUpdateExpense,
  type CreateExpenseFormInput,
} from '@/schemas/expense.schema';
import type { Category, SplitType } from '@/types/db';
import { parseAmountToCents } from '@/utils/money';

/** A scope the expense can belong to: personal (`id: null`) or a group. */
export interface ExpenseScope {
  id: string | null;
  label: string;
  people: Person[];
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
  description: string | null;
  notes: string | null;
  splitType: SplitType;
  participants: Array<{ userId: string; shareCents: number }>;
}

type FieldErrors = {
  title?: string;
  amountCents?: string;
  categoryId?: string;
  expenseDate?: string;
  paidBy?: string;
  split?: string;
};

interface ExpenseFormProps {
  mode: 'create' | 'edit';
  categories: Category[];
  scopes: ExpenseScope[];
  currentUserId: string;
  /** ISO `yyyy-mm-dd` default for the date field (create). */
  defaultDate: string;
  /** Pre-selected scope for create mode (e.g. adding from a group page). */
  defaultScopeId?: string | null;
  /** Lock the scope selector to the initial scope (e.g. a group's add page). */
  lockScope?: boolean;
  initial?: ExpenseFormInitial;
}

function centsToInput(amountCents: number): string {
  return amountCents > 0 ? String(amountCents / 100) : '';
}

/**
 * Add / edit expense form (Client Component). Composes the scope, category,
 * payer, and split controls; the split editor gives a live, engine-backed
 * preview. Shared validation drives inline field errors; `createExpense` /
 * `updateExpense` perform the write. On success it navigates to the expense.
 */
export function ExpenseForm({
  mode,
  categories,
  scopes,
  currentUserId,
  defaultDate,
  defaultScopeId,
  lockScope = false,
  initial,
}: ExpenseFormProps) {
  const router = useRouter();
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [isPending, startTransition] = React.useTransition();

  const hasDefaultScope = scopes.some((s) => s.id === defaultScopeId);
  const [scopeId, setScopeId] = React.useState<string | null>(
    initial?.groupId ??
      (hasDefaultScope ? (defaultScopeId ?? null) : null) ??
      scopes[0]?.id ??
      null,
  );
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
  const [notes, setNotes] = React.useState(initial?.notes ?? '');

  const scope =
    scopes.find((s) => s.id === scopeId) ?? scopes[0] ?? { id: null, label: 'Personal', people: [] };
  const people = scope.people;

  const [payer, setPayer] = React.useState(initial?.paidBy ?? currentUserId);

  // Keep the payer valid when the scope (and thus the people) changes.
  React.useEffect(() => {
    if (people.some((p) => p.id === payer)) return;
    const fallback = people.find((p) => p.id === currentUserId) ?? people[0];
    setPayer(fallback?.id ?? '');
  }, [people, payer, currentUserId]);

  const amountCents = parseAmountToCents(amount);

  const splitRef = React.useRef<SplitEditorValue | null>(null);
  const [splitValid, setSplitValid] = React.useState(false);
  const handleSplitChange = React.useCallback((value: SplitEditorValue) => {
    splitRef.current = value;
    setSplitValid(value.isValid);
  }, []);

  // Restore the saved split only while the initial scope is selected (edit).
  const splitInitial =
    mode === 'edit' && scopeId === (initial?.groupId ?? null) && initial
      ? { splitType: initial.splitType, participants: initial.participants }
      : undefined;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const wire = splitRef.current?.wire;
    const payload: CreateExpenseFormInput = {
      groupId: scopeId,
      title,
      amountCents,
      categoryId: categoryId === '' ? undefined : categoryId,
      expenseDate,
      paidBy: payer,
      notes,
      split: wire,
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

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {!lockScope && scopes.length > 1 ? (
        <div className="space-y-2">
          <Label htmlFor="expense-scope">Group</Label>
          <Select
            id="expense-scope"
            value={scopeId ?? ''}
            onChange={(event) => setScopeId(event.target.value || null)}
            disabled={isPending}
          >
            {scopes.map((option) => (
              <option key={option.id ?? 'personal'} value={option.id ?? ''}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="expense-title">Title</Label>
        <Input
          id="expense-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Dinner"
          aria-invalid={Boolean(errors.title)}
          disabled={isPending}
          autoFocus
        />
        {errors.title ? (
          <p className="text-sm text-destructive">{errors.title}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="expense-amount">Amount</Label>
          <Input
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
          />
          {errors.amountCents ? (
            <p className="text-sm text-destructive">{errors.amountCents}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="expense-date">Date</Label>
          <Input
            id="expense-date"
            type="date"
            value={expenseDate}
            onChange={(event) => setExpenseDate(event.target.value)}
            aria-invalid={Boolean(errors.expenseDate)}
            disabled={isPending}
          />
          {errors.expenseDate ? (
            <p className="text-sm text-destructive">{errors.expenseDate}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CategorySelect
          categories={categories}
          value={categoryId}
          onChange={setCategoryId}
          disabled={isPending}
          error={errors.categoryId}
        />
        <PayerSelect
          people={people}
          value={payer}
          onChange={setPayer}
          disabled={isPending}
        />
      </div>
      {errors.paidBy ? (
        <p className="text-sm text-destructive">{errors.paidBy}</p>
      ) : null}

      <div className="space-y-2">
        <SplitEditor
          key={scope.id ?? 'personal'}
          people={people}
          amountCents={amountCents}
          initial={splitInitial}
          onChange={handleSplitChange}
        />
        {errors.split ? (
          <p className="text-sm text-destructive">{errors.split}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="expense-notes">Notes (optional)</Label>
        <Input
          id="expense-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Anything worth remembering"
          disabled={isPending}
        />
      </div>

      <Button type="submit" disabled={isPending || !splitValid}>
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
