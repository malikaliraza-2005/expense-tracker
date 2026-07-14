/**
 * Settlement validation schemas (Phase 5).
 *
 * Dependency-free validators in the same shape as the auth / friend / expense
 * schemas: the single source of validation truth called by both the Settle Up
 * dialog (inline UX) and the `recordSettlement` Server Action (server input is
 * always untrusted). They validate SHAPE and scalar rules — a positive
 * integer-cent amount, distinct payer/receiver, a bounded note. Authorization
 * (both parties are a friend or share the group; the caller is one of them)
 * lives in the action and RLS, not here.
 *
 * Money crosses this boundary as integer cents (api-design.md §3, §4.6).
 */
import type { ValidationResult } from '@/schemas/auth.schema';

export const SETTLEMENT_NOTE_MAX_LENGTH = 500;

export interface RecordSettlementInput {
  /** Null for a personal (non-group) settlement; a group id otherwise. */
  groupId: string | null;
  payerId: string;
  receiverId: string;
  amountCents: number;
  note: string | null;
}

/** Raw, untrusted form shape (all fields optional). */
export interface RecordSettlementFormInput {
  groupId?: unknown;
  payerId?: unknown;
  receiverId?: unknown;
  amountCents?: unknown;
  note?: unknown;
}

/** The field keys inline errors are reported against. */
type SettlementErrorField =
  | 'groupId'
  | 'payerId'
  | 'receiverId'
  | 'amountCents'
  | 'note';

type SettlementErrors = Partial<Record<SettlementErrorField, string>>;

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

export function validateRecordSettlement(
  input: RecordSettlementFormInput,
): ValidationResult<RecordSettlementInput> {
  const errors: SettlementErrors = {};

  const groupId = isNonEmptyString(input.groupId) ? input.groupId.trim() : null;
  const payerId = asString(input.payerId).trim();
  const receiverId = asString(input.receiverId).trim();
  const amountCents = asNumber(input.amountCents);
  const note = asString(input.note).trim();

  if (!payerId) errors.payerId = 'Choose who paid.';
  if (!receiverId) errors.receiverId = 'Choose who was paid.';
  if (payerId && receiverId && payerId === receiverId) {
    errors.receiverId = 'The payer and receiver must be different people.';
  }

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    errors.amountCents = 'Enter an amount greater than zero.';
  }

  if (note.length > SETTLEMENT_NOTE_MAX_LENGTH) {
    errors.note = `Note must be at most ${SETTLEMENT_NOTE_MAX_LENGTH} characters.`;
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      errors: errors as Partial<Record<keyof RecordSettlementInput, string>>,
    };
  }

  return {
    success: true,
    data: { groupId, payerId, receiverId, amountCents, note: note || null },
  };
}
