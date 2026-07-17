'use client';

import * as React from 'react';

import { cn } from '@/utils/cn';

export interface TabDef {
  key: string;
  label: string;
  /** Optional trailing count pill (rendered only when > 0). */
  count?: number;
}

/**
 * Presentational tab bar — a shared control lifted to `ui/` (the old group-tabs
 * lived under a page that Phase 2 removed). Controlled: the parent owns the active
 * `value`, renders the matching panel, and wires `aria-controls`/panel ids. The
 * active tab gets a neon pill that matches the app nav; the strip scrolls on
 * mobile so extra tabs never wrap. Keyboard: ←/→ move between tabs (roving focus).
 */
export function Tabs({
  tabs,
  value,
  onValueChange,
  ariaLabel,
  idPrefix = 'tab',
  className,
}: {
  tabs: TabDef[];
  value: string;
  onValueChange: (key: string) => void;
  ariaLabel: string;
  /** Prefix for tab/panel ids so a page can host more than one tab set. */
  idPrefix?: string;
  className?: string;
}) {
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.key === value);
    const next = tabs[(index + delta + tabs.length) % tabs.length];
    onValueChange(next.key);
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        '-mx-1 flex gap-1 overflow-x-auto border-b border-border/50 pb-px',
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`${idPrefix}-${tab.key}`}
            aria-selected={active}
            aria-controls={`${idPrefix}-panel-${tab.key}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange(tab.key)}
            className={cn(
              'relative flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {typeof tab.count === 'number' && tab.count > 0 ? (
              <span
                className={cn(
                  'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold',
                  active
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
