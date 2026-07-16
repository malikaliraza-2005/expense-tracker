/**
 * Member validation schemas.
 *
 * A member is just a name the owner types. Dependency-free validators in the
 * same shape as the other schemas: the single source of validation truth called
 * by both the client dialog (inline UX) and the Server Action (server input is
 * always untrusted). No email, account, or invitation — only a name.
 */
import type { ValidationResult } from '@/schemas/auth.schema';

export const MEMBER_NAME_MIN_LENGTH = 1;
export const MEMBER_NAME_MAX_LENGTH = 60;
export const MEMBER_EMAIL_MAX_LENGTH = 200;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface MemberInput {
  name: string;
  email: string | null;
}

export interface AddMemberFormInput {
  name?: unknown;
  email?: unknown;
}

export interface RenameMemberFormInput {
  memberId?: unknown;
  name?: unknown;
  email?: unknown;
}

export interface RenameMemberInput {
  memberId: string;
  name: string;
  email: string | null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function validateName(raw: string): string | undefined {
  if (raw.length < MEMBER_NAME_MIN_LENGTH) return 'Name is required.';
  if (raw.length > MEMBER_NAME_MAX_LENGTH) {
    return `Name must be at most ${MEMBER_NAME_MAX_LENGTH} characters.`;
  }
  return undefined;
}

/** Optional email: only validated when non-empty. Returns an error message. */
function validateOptionalEmail(raw: string): string | undefined {
  if (!raw) return undefined;
  if (raw.length > MEMBER_EMAIL_MAX_LENGTH) return 'That email is too long.';
  if (!EMAIL_RE.test(raw)) return 'Enter a valid email address.';
  return undefined;
}

/** Validate a new member: a required name and an optional email. */
export function validateAddMember(
  input: AddMemberFormInput,
): ValidationResult<MemberInput> {
  const name = asString(input.name).trim();
  const email = asString(input.email).trim();

  const errors: Partial<Record<keyof MemberInput, string>> = {};
  const nameError = validateName(name);
  if (nameError) errors.name = nameError;
  const emailError = validateOptionalEmail(email);
  if (emailError) errors.email = emailError;

  if (Object.keys(errors).length > 0) return { success: false, errors };
  return { success: true, data: { name, email: email || null } };
}

/** Validate an edit: a target member id, a new name, and an optional email. */
export function validateRenameMember(
  input: RenameMemberFormInput,
): ValidationResult<RenameMemberInput> {
  const memberId = asString(input.memberId).trim();
  const name = asString(input.name).trim();
  const email = asString(input.email).trim();

  const errors: Partial<Record<keyof RenameMemberInput, string>> = {};
  if (!memberId) errors.memberId = 'Missing member.';
  const nameError = validateName(name);
  if (nameError) errors.name = nameError;
  const emailError = validateOptionalEmail(email);
  if (emailError) errors.email = emailError;

  if (Object.keys(errors).length > 0) return { success: false, errors };
  return { success: true, data: { memberId, name, email: email || null } };
}
