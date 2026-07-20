/**
 * Expense validation schemas.
 *
 * Dependency-free validators shared by the expense form and the expense Server
 * Actions. They validate SHAPE and scalar ranges — title length, a positive
 * integer-cent amount, a payer, and a non-empty participant list. The split is
 * always EQUAL among the selected members (the app auto-calculates it); the
 * arithmetic invariant (shares sum to the total) is enforced by the split engine
 * (lib/splits.ts) inside the action.
 *
 * Money crosses this boundary as integer cents.
 */
import type { ValidationResult } from '@/schemas/auth.schema';

export const EXPENSE_TITLE_MIN_LENGTH = 1;
export const EXPENSE_TITLE_MAX_LENGTH = 100;
export const EXPENSE_TEXT_MAX_LENGTH = 500;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface CreateExpenseInput {
  /** The group this expense belongs to. Every expense is group-based. */
  groupId: string;
  title: string;
  description: string | null;
  amountCents: number;
  categoryId: number;
  /** ISO `yyyy-mm-dd`. */
  expenseDate: string;
  /** The member who paid. */
  paidBy: string;
  notes: string | null;
  /** The members sharing the expense equally. */
  memberIds: string[];
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
  memberIds?: unknown;
}

export interface UpdateExpenseFormInput extends CreateExpenseFormInput {
  expenseId?: unknown;
}

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
  | 'memberIds';

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

/** Keep only well-formed, unique, non-empty string ids. */
function asIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value
    .filter(isNonEmptyString)
    .map((item) => item.trim());
  return [...new Set(ids)];
}

function validateTitle(raw: string): string | undefined {
  if (raw.length < EXPENSE_TITLE_MIN_LENGTH) return 'Description is required.';
  if (raw.length > EXPENSE_TITLE_MAX_LENGTH) {
    return `Description must be at most ${EXPENSE_TITLE_MAX_LENGTH} characters.`;
  }
  return undefined;
}

function validateOptionalText(raw: string, label: string): string | undefined {
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

function validateCommon(
  input: CreateExpenseFormInput,
  errors: ExpenseErrors,
): CreateExpenseInput | null {
  const groupId = isNonEmptyString(input.groupId) ? input.groupId.trim() : '';
  const title = asString(input.title).trim();
  const description = asString(input.description).trim();
  const notes = asString(input.notes).trim();
  const amountCents = asNumber(input.amountCents);
  const categoryId = asNumber(input.categoryId);
  const expenseDate = asString(input.expenseDate).trim();
  const paidBy = asString(input.paidBy).trim();
  const memberIds = asIdList(input.memberIds);

  if (!groupId) errors.groupId = 'Choose a group.';

  const titleError = validateTitle(title);
  if (titleError) errors.title = titleError;

  const descriptionError = validateOptionalText(description, 'Note');
  if (descriptionError) errors.description = descriptionError;

  const notesError = validateOptionalText(notes, 'Note');
  if (notesError) errors.notes = notesError;

  const amountError = validateAmount(amountCents);
  if (amountError) errors.amountCents = amountError;

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    errors.categoryId = 'Choose a category.';
  }

  const dateError = validateDate(expenseDate);
  if (dateError) errors.expenseDate = dateError;

  if (!paidBy) errors.paidBy = 'Choose who paid.';

  if (memberIds.length === 0) {
    errors.memberIds = 'Select who shared this expense.';
  }

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
    memberIds,
  };
}

export function validateCreateExpense(
  input: CreateExpenseFormInput,
): ValidationResult<CreateExpenseInput> {
  const errors: ExpenseErrors = {};
  const common = validateCommon(input, errors);
  if (!common) {
    return {
      success: false,
      errors: errors as Partial<Record<keyof CreateExpenseInput, string>>,
    };
  }
  return { success: true, data: common };
}

export function validateUpdateExpense(
  input: UpdateExpenseFormInput,
): ValidationResult<UpdateExpenseInput> {
  const errors: ExpenseErrors = {};

  const expenseId = asString(input.expenseId).trim();
  if (!expenseId) errors.expenseId = 'Missing expense.';

  const common = validateCommon(input, errors);
  if (!common || !expenseId) {
    return {
      success: false,
      errors: errors as Partial<Record<keyof UpdateExpenseInput, string>>,
    };
  }

  return { success: true, data: { expenseId, ...common } };
}
