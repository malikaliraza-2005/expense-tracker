'use client';

import * as React from 'react';

/**
 * Return a debounced copy of `value` that only updates after `delayMs` of quiet.
 * Used to throttle search input into URL/query updates so a Server Component
 * re-read fires per pause, not per keystroke.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
