/**
 * Invitation validation schemas (Phase 1).
 *
 * Dependency-free validators in the same shape as the other schemas — the single
 * source of validation truth called by both the client UI and the Server Action
 * (server input is always untrusted). An invite targets EITHER an existing member
 * (`memberId`) or a brand-new person (`name`), always carries a required email,
 * and may optionally deep-link to a target expense or group.
 */
import type { ValidationResult } from '@/schemas/auth.schema';

export const INVITE_EMAIL_MAX_LENGTH = 200;
export const INVITE_NAME_MAX_LENGTH = 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Raw, untrusted form shape. */
export interface InviteFormInput {
  memberId?: unknown;
  name?: unknown;
  email?: unknown;
  targetExpenseId?: unknown;
  targetGroupId?: unknown;
}

/** Validated invite: exactly one of `memberId` / `name`, plus a real email. */
export interface InviteInput {
  memberId: string | null;
  name: string | null;
  email: string;
  targetExpenseId: string | null;
  targetGroupId: string | null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function optionalUuid(value: unknown): string | null {
  const raw = asString(value).trim();
  return raw && UUID_RE.test(raw) ? raw : null;
}

export function validateInvite(
  input: InviteFormInput,
): ValidationResult<InviteInput> {
  const memberId = asString(input.memberId).trim();
  const name = asString(input.name).trim();
  const email = asString(input.email).trim();

  const errors: Partial<Record<keyof InviteInput, string>> = {};

  if (!email) {
    errors.email = 'An email is required to send an invite.';
  } else if (email.length > INVITE_EMAIL_MAX_LENGTH) {
    errors.email = 'That email is too long.';
  } else if (!EMAIL_RE.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  // Need a target: an existing member id, or a name to create one.
  const hasMember = memberId.length > 0;
  if (hasMember && !UUID_RE.test(memberId)) {
    errors.memberId = 'Invalid member.';
  }
  if (!hasMember) {
    if (!name) {
      errors.name = 'A name is required to add and invite a new person.';
    } else if (name.length > INVITE_NAME_MAX_LENGTH) {
      errors.name = `Name must be at most ${INVITE_NAME_MAX_LENGTH} characters.`;
    }
  }

  if (Object.keys(errors).length > 0) return { success: false, errors };

  return {
    success: true,
    data: {
      memberId: hasMember ? memberId : null,
      name: hasMember ? null : name,
      email,
      targetExpenseId: optionalUuid(input.targetExpenseId),
      targetGroupId: optionalUuid(input.targetGroupId),
    },
  };
}
