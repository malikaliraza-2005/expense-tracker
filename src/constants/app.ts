/**
 * App-wide constants. Business decisions baked in from Phase 0:
 * single currency, money as integer cents.
 */

export const APP_NAME = 'Expense Tracker';

/** Single-currency app — no FX logic. ISO 4217 code. */
export const DEFAULT_CURRENCY = 'USD';

/** Locale used for currency/date formatting. */
export const DEFAULT_LOCALE = 'en-US';

/** Money is stored and computed as integer cents everywhere. */
export const CURRENCY_MINOR_UNITS = 100;
