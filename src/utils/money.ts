import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from '@/constants/app';

/**
 * Money is represented as integer cents everywhere in the app.
 * These helpers are the only sanctioned bridge between cents and display/floats.
 * Never do arithmetic on the float form.
 */

/** Convert integer cents to a human string, e.g. 1234 -> "$12.34". */
export function formatCents(
  amountCents: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amountCents / 100);
}

/** Parse a user-entered amount string (e.g. "12.34") into integer cents. */
export function parseAmountToCents(input: string): number {
  const normalized = input.replace(/[^0-9.-]/g, '');
  const value = Number.parseFloat(normalized);
  if (Number.isNaN(value)) return 0;
  return Math.round(value * 100);
}

/** Convert integer cents to a plain decimal number (for form inputs only). */
export function centsToDecimal(amountCents: number): number {
  return amountCents / 100;
}
