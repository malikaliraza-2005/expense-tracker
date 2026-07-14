/** Miscellaneous display formatters (non-money, non-date). */

/** Return initials for an avatar fallback, e.g. "Sara N" -> "SN". */
export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

/** Truncate a string to a maximum length with an ellipsis. */
export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
