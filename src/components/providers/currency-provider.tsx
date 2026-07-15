'use client';

import * as React from 'react';

import { DEFAULT_CURRENCY } from '@/constants/app';
import { currencySymbol, safeCurrency } from '@/constants/currencies';
import { formatCents } from '@/utils/money';

interface CurrencyContextValue {
  /** The user's chosen ISO 4217 currency code. */
  currency: string;
  /** The localised symbol for the current currency, e.g. "$", "₨". */
  symbol: string;
  /** Format integer cents in the current currency, e.g. 1234 → "$12.34". */
  format: (cents: number) => string;
}

const CurrencyContext = React.createContext<CurrencyContextValue>({
  currency: DEFAULT_CURRENCY,
  symbol: currencySymbol(DEFAULT_CURRENCY),
  format: (cents) => formatCents(cents, DEFAULT_CURRENCY),
});

/**
 * Makes the user's chosen currency available to every money display in the app
 * shell. Seeded from the profile on the server so SSR already renders the right
 * symbol (no flash / hydration mismatch). The number grouping stays on the app
 * locale; only the currency symbol/code follows the user's choice.
 */
export function CurrencyProvider({
  initialCurrency,
  children,
}: {
  initialCurrency: string | null | undefined;
  children: React.ReactNode;
}) {
  const currency = safeCurrency(initialCurrency);
  const value = React.useMemo<CurrencyContextValue>(
    () => ({
      currency,
      symbol: currencySymbol(currency),
      format: (cents: number) => formatCents(cents, currency),
    }),
    [currency],
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

/** Read the active currency and a `format(cents)` helper for it. */
export function useCurrency(): CurrencyContextValue {
  return React.useContext(CurrencyContext);
}
