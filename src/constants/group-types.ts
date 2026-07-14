/**
 * Group type catalogue (Phase 3). Mirrors the `group_type` database enum
 * (database-design.md §4) and provides display labels for the type selector and
 * group cards. The values here are the single source the validation layer and UI
 * both draw from, so a new type is added in exactly one place.
 */
import type { GroupType } from '@/types/db';

export interface GroupTypeOption {
  value: GroupType;
  label: string;
}

/** Ordered options for the create/edit group type selector. */
export const GROUP_TYPES: readonly GroupTypeOption[] = [
  { value: 'trip', label: 'Trip' },
  { value: 'home', label: 'Home' },
  { value: 'friends', label: 'Friends' },
  { value: 'couple', label: 'Couple' },
  { value: 'office', label: 'Office' },
  { value: 'other', label: 'Other' },
] as const;

/** Every valid `group_type` value — used by the validation layer. */
export const GROUP_TYPE_VALUES: readonly GroupType[] = GROUP_TYPES.map(
  (option) => option.value,
);

/** Default type applied when none is chosen (matches the DB column default). */
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
