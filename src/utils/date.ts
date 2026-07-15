import { DEFAULT_LOCALE } from '@/constants/app';

/**
 * Parse a value into a Date. Date-only strings (`YYYY-MM-DD`) are treated as
 * LOCAL midnight — not UTC — so a stored expense date never shifts by a day when
 * displayed in the viewer's timezone.
 */
export function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(value);
}

/**
 * Format a date as a short human date, e.g. "Jul 14, 2026". Pass `locale` to
 * override; leave it undefined to follow the runtime/browser locale.
 */
export function formatDate(
  value: string | Date,
  locale: string | undefined = DEFAULT_LOCALE,
): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(toDate(value));
}

/** Return a LOCAL ISO date-only string (YYYY-MM-DD) for a Date (default: now). */
export function toISODate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * A friendly relative label for a date relative to today ("Today", "Yesterday",
 * "Tomorrow", "3 days ago", "in 2 days"), or `null` when it's far enough away
 * that an absolute date reads better (beyond ~6 days either side).
 */
export function relativeDay(value: string | Date, now: Date = new Date()): string | null {
  const date = toDate(value);
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round(
    (startOfDay(date) - startOfDay(now)) / 86_400_000,
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 0 && diffDays >= -6) return `${-diffDays} days ago`;
  if (diffDays > 0 && diffDays <= 6) return `in ${diffDays} days`;
  return null;
}
