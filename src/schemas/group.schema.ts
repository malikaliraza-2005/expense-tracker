/**
 * Group validation schemas (Phase 3).
 *
 * Dependency-free validators (auth.schema.ts style) shared by the group form and
 * the group Server Actions. They validate shape only — name length, a valid
 * `group_type`, well-formed member id lists. Authorization ("are you the owner?")
 * and existence checks live in the actions and RLS.
 */
import { GROUP_TYPE_VALUES, isGroupType } from '@/constants/group-types';
import type { ValidationResult } from '@/schemas/auth.schema';
import type { GroupType } from '@/types/db';

export const GROUP_NAME_MIN_LENGTH = 1;
export const GROUP_NAME_MAX_LENGTH = 60;

export interface CreateGroupInput {
  name: string;
  type: GroupType;
  memberIds: string[];
}

export interface UpdateGroupInput {
  groupId: string;
  /** Optional — partial update; omit to leave the name unchanged. */
  name?: string;
  /** Optional — partial update; omit to leave the type unchanged. */
  type?: GroupType;
}

export interface GroupMemberInput {
  groupId: string;
  userId: string;
}

/** Raw, untrusted form shapes. */
export interface CreateGroupFormInput {
  name?: unknown;
  type?: unknown;
  memberIds?: unknown;
}

export interface UpdateGroupFormInput {
  groupId?: unknown;
  name?: unknown;
  type?: unknown;
}

export interface GroupMemberFormInput {
  groupId?: unknown;
  userId?: unknown;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Keep only well-formed, unique, non-empty string ids. */
function asIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return [...new Set(ids)];
}

function validateName(raw: string): string | undefined {
  if (raw.length < GROUP_NAME_MIN_LENGTH) return 'Group name is required.';
  if (raw.length > GROUP_NAME_MAX_LENGTH) {
    return `Group name must be at most ${GROUP_NAME_MAX_LENGTH} characters.`;
  }
  return undefined;
}

function validateType(raw: unknown): string | undefined {
  if (!isGroupType(raw)) {
    return `Choose one of: ${GROUP_TYPE_VALUES.join(', ')}.`;
  }
  return undefined;
}

export function validateCreateGroup(
  input: CreateGroupFormInput,
): ValidationResult<CreateGroupInput> {
  const name = asString(input.name).trim();
  const type = input.type;
  const memberIds = asIdList(input.memberIds);

  const errors: Partial<Record<keyof CreateGroupInput, string>> = {};

  const nameError = validateName(name);
  if (nameError) errors.name = nameError;

  const typeError = validateType(type);
  if (typeError) errors.type = typeError;

  if (Object.keys(errors).length > 0) return { success: false, errors };
  return { success: true, data: { name, type: type as GroupType, memberIds } };
}

export function validateUpdateGroup(
  input: UpdateGroupFormInput,
): ValidationResult<UpdateGroupInput> {
  const groupId = asString(input.groupId).trim();

  const errors: Partial<Record<keyof UpdateGroupInput, string>> = {};
  if (!groupId) errors.groupId = 'Missing group.';

  // Partial update (api-design.md §4.4): only validate fields that are present.
  // An omitted field (`undefined`) is left unchanged; a supplied field must be
  // valid.
  const data: UpdateGroupInput = { groupId };

  if (input.name !== undefined) {
    const name = asString(input.name).trim();
    const nameError = validateName(name);
    if (nameError) errors.name = nameError;
    else data.name = name;
  }

  if (input.type !== undefined) {
    const typeError = validateType(input.type);
    if (typeError) errors.type = typeError;
    else data.type = input.type as GroupType;
  }

  if (Object.keys(errors).length > 0) return { success: false, errors };
  return { success: true, data };
}

export function validateGroupMember(
  input: GroupMemberFormInput,
): ValidationResult<GroupMemberInput> {
  const groupId = asString(input.groupId).trim();
  const userId = asString(input.userId).trim();

  const errors: Partial<Record<keyof GroupMemberInput, string>> = {};
  if (!groupId) errors.groupId = 'Missing group.';
  if (!userId) errors.userId = 'Missing member.';

  if (Object.keys(errors).length > 0) return { success: false, errors };
  return { success: true, data: { groupId, userId } };
}
