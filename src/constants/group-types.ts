/**
 * Group type catalogue. Mirrors the `group_type` database enum (migration 0002):
 * trip | home | friends | couple | office | other. Single source the group form
 * and validation draw from.
 */
import type { GroupType } from '@/types/db';

export interface GroupTypeOption {
  value: GroupType;
  label: string;
}

export const GROUP_TYPES: readonly GroupTypeOption[] = [
  { value: 'trip', label: 'Trip' },
  { value: 'home', label: 'Home' },
  { value: 'friends', label: 'Friends' },
  { value: 'couple', label: 'Couple' },
  { value: 'office', label: 'Office' },
  { value: 'other', label: 'Other' },
] as const;

export const GROUP_TYPE_VALUES: readonly GroupType[] = GROUP_TYPES.map(
  (option) => option.value,
);

export const DEFAULT_GROUP_TYPE: GroupType = 'other';

/** Narrowing guard: is `value` a valid group type? */
export function isGroupType(value: unknown): value is GroupType {
  return (
    typeof value === 'string' &&
    (GROUP_TYPE_VALUES as readonly string[]).includes(value)
  );
}

/** Human label for a group type, falling back to the raw value. */
export function groupTypeLabel(value: GroupType): string {
  return GROUP_TYPES.find((option) => option.value === value)?.label ?? value;
}
