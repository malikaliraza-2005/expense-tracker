'use client';

import * as React from 'react';

import { Clock } from 'lucide-react';

/** Time-of-day greeting from the local hour. */
function greetingFor(hour: number): string {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * A live, self-updating greeting + local date & clock. Ticks every second and
 * uses the viewer's own locale and timezone via `Intl` (no fixed locale), so the
 * date and time are always correct wherever they are. Renders a stable
 * placeholder on the server to avoid a hydration mismatch, then fills in on
 * mount.
 */
export function LiveClock({ name }: { name?: string | null }) {
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    // Reserve height so the layout doesn't shift when the clock appears.
    return <div className="h-7" aria-hidden />;
  }

  const dateStr = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(now);
  const timeStr = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(now);
  const first = name?.trim().split(/\s+/)[0];

  return (
    <div
      className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs font-medium text-muted-foreground"
      suppressHydrationWarning
    >
      <Clock className="h-3.5 w-3.5 text-primary" />
      <span className="text-foreground">
        {greetingFor(now.getHours())}
        {first ? `, ${first}` : ''}
      </span>
      <span className="text-muted-foreground/40">·</span>
      <span>{dateStr}</span>
      <span className="text-muted-foreground/40">·</span>
      <span className="tabular-nums">{timeStr}</span>
    </div>
  );
}
