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

export interface MemberNameInput {
  name: string;
}

export interface AddMemberFormInput {
  name?: unknown;
}

export interface RenameMemberFormInput {
  memberId?: unknown;
  name?: unknown;
}

export interface RenameMemberInput {
  memberId: string;
  name: string;
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

/** Validate a new member's name. */
export function validateAddMember(
  input: AddMemberFormInput,
): ValidationResult<MemberNameInput> {
  const name = asString(input.name).trim();
  const error = validateName(name);
  if (error) return { success: false, errors: { name: error } };
  return { success: true, data: { name } };
}

/** Validate a rename: a target member id plus the new name. */
export function validateRenameMember(
  input: RenameMemberFormInput,
): ValidationResult<RenameMemberInput> {
  const memberId = asString(input.memberId).trim();
  const name = asString(input.name).trim();

  const errors: Partial<Record<keyof RenameMemberInput, string>> = {};
  if (!memberId) errors.memberId = 'Missing member.';
  const nameError = validateName(name);
  if (nameError) errors.name = nameError;

  if (Object.keys(errors).length > 0) return { success: false, errors };
  return { success: true, data: { memberId, name } };
}
