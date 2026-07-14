/**
 * Friend validation schemas (Phase 3).
 *
 * Dependency-free validators in the same shape as auth.schema.ts: the single
 * source of validation truth called by both the client dialog (inline UX) and
 * the Server Action (server input is always untrusted). Business rules that need
 * the database — "account exists", "not yourself", "not already friends" — are
 * enforced in the action, not here.
 */
import type { ValidationResult } from '@/schemas/auth.schema';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AddFriendInput {
  email: string;
}

/** Raw, untrusted form shape. */
export interface AddFriendFormInput {
  email?: unknown;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function validateAddFriend(
  input: AddFriendFormInput,
): ValidationResult<AddFriendInput> {
  const email = asString(input.email).trim().toLowerCase();

  const errors: Partial<Record<keyof AddFriendInput, string>> = {};
  if (!email) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_RE.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (Object.keys(errors).length > 0) return { success: false, errors };
  return { success: true, data: { email } };
}
