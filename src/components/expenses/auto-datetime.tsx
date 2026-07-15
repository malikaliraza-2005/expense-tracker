'use client';

import * as React from 'react';

import { CalendarClock } from 'lucide-react';

import { LocalDate } from '@/components/common/local-date';

/**
 * Read-only date field for the expense form. The date is set automatically (no
 * manual picker). In `live` mode it also shows the current local time, ticking
 * in real time, so the moment being recorded is always visible.
 */
export function AutoDateTime({
  value,
  live = false,
}: {
  value: string;
  live?: boolean;
}) {
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    if (!live) return;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [live]);

  const time = now
    ? new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      }).format(now)
    : null;

  return (
    <div className="flex h-11 items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3.5 text-sm">
      <CalendarClock className="h-4 w-4 shrink-0 text-primary" />
      <LocalDate value={value} className="font-medium text-foreground" />
      {live && time ? (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span className="tabular-nums text-muted-foreground" suppressHydrationWarning>
            {time}
          </span>
        </>
      ) : null}
    </div>
  );
}
