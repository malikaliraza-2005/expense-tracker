import * as React from 'react';

import { cn } from '@/utils/cn';

/**
 * Designed empty state — no list should dead-end in a blank screen
 * (development-guidelines.md §4). Optional icon, title, description, and an
 * action slot (e.g. the primary "add" affordance).
 */
export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex animate-fade-in-up flex-col items-center justify-center rounded-xl border border-dashed bg-card/40 p-10 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-muted to-muted/60 text-muted-foreground shadow-soft ring-1 ring-border [&_svg]:h-7 [&_svg]:w-7">
          {icon}
        </div>
      ) : null}
      <h2 className="text-base font-medium">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
