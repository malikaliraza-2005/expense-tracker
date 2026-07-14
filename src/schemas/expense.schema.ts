/**
 * Expense validation schemas (Phase 4).
 *
 * Dependency-free validators (auth.schema.ts / group.schema.ts style) shared by
 * the expense form and the expense Server Actions. They validate SHAPE and
 * scalar ranges — title length, a positive integer-cent amount, a valid split
 * envelope. The split ARITHMETIC invariant (shares sum to the total,
 * percentages sum to 100) is enforced separately by the split engine
 * (lib/splits.ts) inside the action, and authorization (payer/participant
 * membership) lives in the action and RLS.
 *
 * Money crosses this boundary as integer cents (api-design.md §3, §4.5).
 */
import { isSplitType } from '@/constants/split-types';
import type { ValidationResult } from '@/schemas/auth.schema';
import type { SplitType } from '@/types/db';

export const EXPENSE_TITLE_MIN_LENGTH = 1;
export const EXPENSE_TITLE_MAX_LENGTH = 100;
export const EXPENSE_TEXT_MAX_LENGTH = 500;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Wire form of a split, discriminated by `type` (api-design.md §4.5). The action
 * maps this to the split engine's {@link SplitInput}; shares/percentages are the
 * user-entered values, validated for shape here and for sum in the action.
 */
export type SplitInputWire =
  | { type: 'equal'; participantIds: string[] }
  | { type: 'exact'; shares: Array<{ userId: string; amountCents: number }> }
  | { type: 'percentage'; shares: Array<{ userId: string; percent: number }> };

export interface CreateExpenseInput {
  /** Null for a personal / 1:1 expense; a group id otherwise. */
  groupId: string | null;
  title: string;
  description: string | null;
  amountCents: number;
  categoryId: number;
  /** ISO `yyyy-mm-dd`. */
  expenseDate: string;
  paidBy: string;
  notes: string | null;
  split: SplitInputWire;
}

export interface UpdateExpenseInput extends CreateExpenseInput {
  expenseId: string;
}

/** Raw, untrusted form shapes. */
export interface CreateExpenseFormInput {
  groupId?: unknown;
  title?: unknown;
  description?: unknown;
  amountCents?: unknown;
  categoryId?: unknown;
  expenseDate?: unknown;
  paidBy?: unknown;
  notes?: unknown;
  split?: unknown;
}

export interface UpdateExpenseFormInput extends CreateExpenseFormInput {
  expenseId?: unknown;
}

/** The field keys inline errors are reported against. */
type ExpenseErrorField =
  | 'expenseId'
  | 'groupId'
  | 'title'
  | 'description'
  | 'amountCents'
  | 'categoryId'
  | 'expenseDate'
  | 'paidBy'
  | 'notes'
  | 'split';

type ExpenseErrors = Partial<Record<ExpenseErrorField, string>>;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return Number.NaN;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateTitle(raw: string): string | undefined {
  if (raw.length < EXPENSE_TITLE_MIN_LENGTH) return 'Title is required.';
  if (raw.length > EXPENSE_TITLE_MAX_LENGTH) {
    return `Title must be at most ${EXPENSE_TITLE_MAX_LENGTH} characters.`;
  }
  return undefined;
}

function validateOptionalText(
  raw: string,
  label: string,
): string | undefined {
  if (raw.length > EXPENSE_TEXT_MAX_LENGTH) {
    return `${label} must be at most ${EXPENSE_TEXT_MAX_LENGTH} characters.`;
  }
  return undefined;
}

function validateAmount(cents: number): string | undefined {
  if (!Number.isInteger(cents) || cents <= 0) {
    return 'Enter an amount greater than zero.';
  }
  return undefined;
}

function validateDate(raw: string): string | undefined {
  if (!DATE_RE.test(raw) || Number.isNaN(Date.parse(raw))) {
    return 'Enter a valid date.';
  }
  return undefined;
}

/**
 * Validate the split envelope's shape (type + well-formed entries) and return a
 * normalized {@link SplitInputWire}. Sum/percentage-total checks are the split
 * engine's job in the action.
 */
function validateSplit(
  value: unknown,
): { ok: true; split: SplitInputWire } | { ok: false; error: string } {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, error: 'Choose how to split this expense.' };
  }
  const raw = value as { type?: unknown; participantIds?: unknown; shares?: unknown };
  if (!isSplitType(raw.type)) {
    return { ok: false, error: 'Choose a valid split type.' };
  }
  const type = raw.type as SplitType;

  if (type === 'equal') {
    const participantIds = Array.isArray(raw.participantIds)
      ? [...new Set(raw.participantIds.filter(isNonEmptyString).map((id) => id.trim()))]
      : [];
    if (participantIds.length === 0) {
      return { ok: false, error: 'Select at least one participant.' };
    }
    return { ok: true, split: { type: 'equal', participantIds } };
  }

  if (!Array.isArray(raw.shares) || raw.shares.length === 0) {
    return { ok: false, error: 'Select at least one participant.' };
  }

  if (type === 'exact') {
    const shares: Array<{ userId: string; amountCents: number }> = [];
    for (const entry of raw.shares) {
      const e = entry as { userId?: unknown; amountCents?: unknown };
      const userId = asString(e.userId).trim();
      const amountCents = asNumber(e.amountCents);
      if (!userId) return { ok: false, error: 'Each share needs a participant.' };
      if (!Number.isInteger(amountCents) || amountCents < 0) {
        return { ok: false, error: 'Each share must be a non-negative amount.' };
      }
      shares.push({ userId, amountCents });
    }
    return { ok: true, split: { type: 'exact', shares } };
  }

  // percentage
  const shares: Array<{ userId: string; percent: number }> = [];
  for (const entry of raw.shares) {
    const e = entry as { userId?: unknown; percent?: unknown };
    const userId = asString(e.userId).trim();
    const percent = asNumber(e.percent);
    if (!userId) return { ok: false, error: 'Each share needs a participant.' };
    if (!Number.isFinite(percent) || percent < 0) {
      return { ok: false, error: 'Each percentage must be a non-negative number.' };
    }
    shares.push({ userId, percent });
  }
  return { ok: true, split: { type: 'percentage', shares } };
}

function validateCommon(
  input: CreateExpenseFormInput,
  errors: ExpenseErrors,
): Omit<CreateExpenseInput, 'split'> | null {
  const groupId = isNonEmptyString(input.groupId) ? input.groupId.trim() : null;
  const title = asString(input.title).trim();
  const description = asString(input.description).trim();
  const notes = asString(input.notes).trim();
  const amountCents = asNumber(input.amountCents);
  const categoryId = asNumber(input.categoryId);
  const expenseDate = asString(input.expenseDate).trim();
  const paidBy = asString(input.paidBy).trim();

  const titleError = validateTitle(title);
  if (titleError) errors.title = titleError;

  const descriptionError = validateOptionalText(description, 'Description');
  if (descriptionError) errors.description = descriptionError;

  const notesError = validateOptionalText(notes, 'Notes');
  if (notesError) errors.notes = notesError;

  const amountError = validateAmount(amountCents);
  if (amountError) errors.amountCents = amountError;

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    errors.categoryId = 'Choose a category.';
  }

  const dateError = validateDate(expenseDate);
  if (dateError) errors.expenseDate = dateError;

  if (!paidBy) errors.paidBy = 'Choose who paid.';

  if (Object.keys(errors).length > 0) return null;

  return {
    groupId,
    title,
    description: description || null,
    amountCents,
    categoryId,
    expenseDate,
    paidBy,
    notes: notes || null,
  };
}

export function validateCreateExpense(
  input: CreateExpenseFormInput,
): ValidationResult<CreateExpenseInput> {
  const errors: ExpenseErrors = {};

  const splitResult = validateSplit(input.split);
  if (!splitResult.ok) errors.split = splitResult.error;

  const common = validateCommon(input, errors);
  if (!common || !splitResult.ok) {
    return {
      success: false,
      errors: errors as Partial<Record<keyof CreateExpenseInput, string>>,
    };
  }

  return { success: true, data: { ...common, split: splitResult.split } };
}

export function validateUpdateExpense(
  input: UpdateExpenseFormInput,
): ValidationResult<UpdateExpenseInput> {
  const errors: ExpenseErrors = {};

  const expenseId = asString(input.expenseId).trim();
  if (!expenseId) errors.expenseId = 'Missing expense.';

  const splitResult = validateSplit(input.split);
  if (!splitResult.ok) errors.split = splitResult.error;

  const common = validateCommon(input, errors);
  if (!common || !splitResult.ok || !expenseId) {
    return {
      success: false,
      errors: errors as Partial<Record<keyof UpdateExpenseInput, string>>,
    };
  }

  return {
    success: true,
    data: { expenseId, ...common, split: splitResult.split },
  };
}
