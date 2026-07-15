'use client';

import * as React from 'react';

import { DEFAULT_LOCALE } from '@/constants/app';
import { relativeDay, toDate } from '@/utils/date';

/**
 * Renders a date in the viewer's own locale and timezone, with a friendly
 * relative label for nearby dates ("Today", "Yesterday", "3 days ago"). The
 * server renders a stable absolute date (app locale); on mount the component
 * re-renders using the browser locale and keeps the relative label current (it
 * re-checks every minute, so "Today" rolls over to "Yesterday" without a
 * reload). `suppressHydrationWarning` absorbs the intended server↔client diff.
 */
export function LocalDate({
  value,
  className,
  relative = true,
}: {
  value: string | Date;
  className?: string;
  /** Show "Today"/"Yesterday"/"N days ago" when the date is near. */
  relative?: boolean;
}) {
  const [mounted, setMounted] = React.useState(false);
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const date = toDate(value);
  // Before mount use the app locale (matches SSR); after mount follow the
  // browser locale by passing `undefined` to Intl.
  const absolute = new Intl.DateTimeFormat(mounted ? undefined : DEFAULT_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
  const label = relative && mounted ? relativeDay(value) : null;

  return (
    <span className={className} suppressHydrationWarning title={absolute}>
      {label ?? absolute}
    </span>
  );
}
