/**
 * Settlement validation schema.
 *
 * A settlement is a recorded transfer between two of the owner's members: the
 * payer hands the receiver an amount, which the balance engine nets against
 * their outstanding debt. Dependency-free validators in the same shape as the
 * other schemas — the single source of validation truth, called by both the
 * client dialog (inline UX) and the Server Action (server input is untrusted).
 */
import type { ValidationResult } from '@/schemas/auth.schema';

/** Upper bound mirrors the expense amount ceiling: 10 million major units. */
export const SETTLEMENT_MAX_CENTS = 1_000_000_000;
export const SETTLEMENT_NOTE_MAX_LENGTH = 200;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RecordSettlementFormInput {
  payerId?: unknown;
  receiverId?: unknown;
  amountCents?: unknown;
  note?: unknown;
  /** Optional group the settlement belongs to (scopes it to that ledger). */
  groupId?: unknown;
}

export interface RecordSettlementInput {
  payerId: string;
  receiverId: string;
  amountCents: number;
  note: string | null;
  /** The group this settlement is scoped to, or null for general activity. */
  groupId: string | null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Validate a settlement: two distinct owned members and a positive amount. */
export function validateRecordSettlement(
  input: RecordSettlementFormInput,
): ValidationResult<RecordSettlementInput> {
  const payerId = asString(input.payerId).trim();
  const receiverId = asString(input.receiverId).trim();
  const amountCents =
    typeof input.amountCents === 'number' ? input.amountCents : NaN;
  const note = asString(input.note).trim();
  const groupIdRaw = asString(input.groupId).trim();

  const errors: Partial<Record<keyof RecordSettlementInput, string>> = {};

  if (!UUID_RE.test(payerId)) errors.payerId = 'Missing payer.';
  if (!UUID_RE.test(receiverId)) errors.receiverId = 'Missing receiver.';
  if (payerId && receiverId && payerId === receiverId) {
    errors.receiverId = 'Payer and receiver must be different people.';
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    errors.amountCents = 'Enter an amount greater than zero.';
  } else if (amountCents > SETTLEMENT_MAX_CENTS) {
    errors.amountCents = 'That amount is too large.';
  }
  if (note.length > SETTLEMENT_NOTE_MAX_LENGTH) {
    errors.note = `Note must be at most ${SETTLEMENT_NOTE_MAX_LENGTH} characters.`;
  }
  // A group id, when present, must be a well-formed uuid; absent means general.
  if (groupIdRaw && !UUID_RE.test(groupIdRaw)) {
    errors.groupId = 'Invalid group.';
  }

  if (Object.keys(errors).length > 0) return { success: false, errors };
  return {
    success: true,
    data: {
      payerId,
      receiverId,
      amountCents,
      note: note || null,
      groupId: groupIdRaw || null,
    },
  };
}
