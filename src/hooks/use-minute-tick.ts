'use client';

import * as React from 'react';

/**
 * A single, app-wide minute ticker shared by every subscriber.
 *
 * Components that show relative dates ("Today", "3 days ago") need to re-render
 * roughly once a minute so the label rolls over without a reload. Giving each one
 * its own `setInterval` means a list of N rows spins up N timers, each waking the
 * main thread and re-rendering independently. Instead, one module-level interval
 * (created lazily on the first subscriber, torn down after the last) drives them
 * all: N rows cost one timer, not N.
 */
let subscribers = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

const TICK_MS = 60_000;

function start(): void {
  if (intervalId !== null) return;
  intervalId = setInterval(() => {
    for (const listener of listeners) listener();
  }, TICK_MS);
}

function stop(): void {
  if (intervalId === null) return;
  clearInterval(intervalId);
  intervalId = null;
}

/**
 * Subscribe to the shared minute tick. Returns a value that changes once per
 * minute, so a component reading it re-renders on each tick. Cheap to use from
 * many components at once — they share one timer.
 */
export function useMinuteTick(): number {
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    subscribers += 1;
    start();

    return () => {
      listeners.delete(listener);
      subscribers -= 1;
      if (subscribers <= 0) stop();
    };
  }, []);

  return tick;
}
