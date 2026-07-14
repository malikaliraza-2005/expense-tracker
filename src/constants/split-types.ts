/**
 * Split type catalogue (Phase 4). Mirrors the `split_type` database enum
 * (database-design.md §4) and the three modes of the split engine
 * (lib/splits.ts). The values here are the single source the validation layer,
 * the split editor, and the expense form all draw from, so a new split type is
 * added in exactly one place.
 */
import type { SplitType } from '@/types/db';

export interface SplitTypeOption {
  value: SplitType;
  label: string;
  /** Short helper text shown under the selector in the split editor. */
  hint: string;
}

/** Ordered options for the split-type selector. */
export const SPLIT_TYPES: readonly SplitTypeOption[] = [
  { value: 'equal', label: 'Equally', hint: 'Split the total evenly between everyone.' },
  {
    value: 'exact',
    label: 'Exact amounts',
    hint: 'Enter each person’s share. Shares must add up to the total.',
  },
  {
    value: 'percentage',
    label: 'Percentages',
    hint: 'Enter each person’s percentage. Percentages must add up to 100%.',
  },
] as const;

/** Every valid `split_type` value — used by the validation layer. */
export const SPLIT_TYPE_VALUES: readonly SplitType[] = SPLIT_TYPES.map(
  (option) => option.value,
);

/** Default split applied when none is chosen. */
export const DEFAULT_SPLIT_TYPE: SplitType = 'equal';

/** Narrowing guard: is `value` a valid split type? */
export function isSplitType(value: unknown): value is SplitType {
  return (
    typeof value === 'string' &&
    (SPLIT_TYPE_VALUES as readonly string[]).includes(value)
  );
}

/** Human label for a split type, falling back to the raw value. */
export function splitTypeLabel(value: SplitType): string {
  return SPLIT_TYPES.find((option) => option.value === value)?.label ?? value;
}
