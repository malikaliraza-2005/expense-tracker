/**
 * Worldwide currency support. The list is derived from the JS runtime's own ISO
 * 4217 data (`Intl.supportedValuesOf('currency')`) so it covers every currency
 * the platform knows about — no hand-maintained table. Names and symbols come
 * from `Intl.DisplayNames` / `Intl.NumberFormat`, localised to the given locale.
 */

import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from '@/constants/app';

export interface CurrencyInfo {
  /** ISO 4217 code, e.g. "USD". */
  code: string;
  /** Localised display name, e.g. "US Dollar". */
  name: string;
  /** Localised symbol, e.g. "$", "€", "₨". */
  symbol: string;
}

/** A small set surfaced first in pickers for quick access. */
export const POPULAR_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'PKR',
  'INR',
  'AED',
  'SAR',
  'JPY',
  'CNY',
  'CAD',
  'AUD',
  'CHF',
  'SGD',
] as const;

/** Every ISO 4217 code the runtime supports (falls back to the popular set). */
function supportedCurrencyCodes(): string[] {
  try {
    const anyIntl = Intl as unknown as {
      supportedValuesOf?: (key: string) => string[];
    };
    const codes = anyIntl.supportedValuesOf?.('currency');
    if (Array.isArray(codes) && codes.length > 0) return codes;
  } catch {
    // Older runtime — fall through to the curated list.
  }
  return [...POPULAR_CURRENCIES];
}

const CODES = supportedCurrencyCodes();
const CODE_SET = new Set(CODES);

/** Resolve a currency's localised symbol (e.g. "$"), falling back to its code. */
function symbolFor(code: string, locale: string): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? code;
  } catch {
    return code;
  }
}

/**
 * The full worldwide currency list — popular codes first, then the rest
 * alphabetically by name. Memoised per locale.
 */
const CACHE = new Map<string, CurrencyInfo[]>();
export function listCurrencies(locale: string = DEFAULT_LOCALE): CurrencyInfo[] {
  const cached = CACHE.get(locale);
  if (cached) return cached;

  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: 'currency' });
  } catch {
    names = null;
  }

  const toInfo = (code: string): CurrencyInfo => ({
    code,
    name: (() => {
      try {
        return names?.of(code) ?? code;
      } catch {
        return code;
      }
    })(),
    symbol: symbolFor(code, locale),
  });

  const popular = (POPULAR_CURRENCIES as readonly string[]).filter((c) =>
    CODE_SET.has(c),
  );
  const popularSet = new Set(popular);
  const rest = CODES.filter((c) => !popularSet.has(c))
    .map(toInfo)
    .sort((a, b) => a.name.localeCompare(b.name));

  const result = [...popular.map(toInfo), ...rest];
  CACHE.set(locale, result);
  return result;
}

/** The localised symbol for a currency code, e.g. "USD" → "$", "PKR" → "₨". */
export function currencySymbol(
  code: string | null | undefined,
  locale: string = DEFAULT_LOCALE,
): string {
  return symbolFor(safeCurrency(code), locale);
}

/** True when `code` is a currency the runtime recognises (or a valid shape). */
export function isValidCurrencyCode(code: string): boolean {
  if (!/^[A-Z]{3}$/.test(code)) return false;
  return CODE_SET.size === 0 || CODE_SET.has(code);
}

/** Normalise/guard a stored currency to a safe value for formatting. */
export function safeCurrency(code: string | null | undefined): string {
  return code && isValidCurrencyCode(code) ? code : DEFAULT_CURRENCY;
}
