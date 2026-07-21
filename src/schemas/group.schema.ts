/**
 * Group validation schemas. Dependency-free validators in the same shape as the
 * other schemas — the single source of validation truth called by both the
 * client dialogs (inline UX) and the Server Actions (server input is untrusted).
 */
import { DEFAULT_GROUP_TYPE, isGroupType } from '@/constants/group-types';
import type { ValidationResult } from '@/schemas/auth.schema';
import type { GroupType } from '@/types/db';

export const GROUP_NAME_MIN_LENGTH = 1;
export const GROUP_NAME_MAX_LENGTH = 60;

export interface CreateGroupInput {
  name: string;
  type: GroupType;
}

export interface RenameGroupInput {
  groupId: string;
  name: string;
  type: GroupType;
}

export interface CreateGroupFormInput {
  name?: unknown;
  type?: unknown;
}

export interface RenameGroupFormInput {
  groupId?: unknown;
  name?: unknown;
  type?: unknown;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function validateName(raw: string): string | undefined {
  if (raw.length < GROUP_NAME_MIN_LENGTH) return 'Name is required.';
  if (raw.length > GROUP_NAME_MAX_LENGTH) {
    return `Name must be at most ${GROUP_NAME_MAX_LENGTH} characters.`;
  }
  return undefined;
}

/** Validate a new group: a name and a (defaulted) type. */
export function validateCreateGroup(
  input: CreateGroupFormInput,
): ValidationResult<CreateGroupInput> {
  const name = asString(input.name).trim();
  const nameError = validateName(name);
  if (nameError) return { success: false, errors: { name: nameError } };
  const type = isGroupType(input.type) ? input.type : DEFAULT_GROUP_TYPE;
  return { success: true, data: { name, type } };
}

/** Validate a rename/retype: a target group id, a new name, and a type. */
export function validateRenameGroup(
  input: RenameGroupFormInput,
): ValidationResult<RenameGroupInput> {
  const groupId = asString(input.groupId).trim();
  const name = asString(input.name).trim();

  const errors: Partial<Record<keyof RenameGroupInput, string>> = {};
  if (!groupId) errors.groupId = 'Missing group.';
  const nameError = validateName(name);
  if (nameError) errors.name = nameError;

  if (Object.keys(errors).length > 0) return { success: false, errors };
  const type = isGroupType(input.type) ? input.type : DEFAULT_GROUP_TYPE;
  return { success: true, data: { groupId, name, type } };
}
