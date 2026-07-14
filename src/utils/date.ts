import { DEFAULT_LOCALE } from '@/constants/app';

/** Format an ISO date string / Date as a short human date, e.g. "Jul 14, 2026". */
export function formatDate(
  value: string | Date,
  locale: string = DEFAULT_LOCALE,
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/** Return an ISO date-only string (YYYY-MM-DD) for a Date. */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
