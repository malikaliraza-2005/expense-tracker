import * as React from 'react';

import { APP_NAME } from '@/constants/app';
import { cn } from '@/utils/cn';

/**
 * App brand mark + wordmark, used consistently across the auth pages, sidebar,
 * mobile nav, and profile. The mark echoes the favicon/logo.svg (a coin with a
 * vertical bar) but is drawn with theme tokens so it adapts to light and dark:
 * a gradient `primary` tile with a `primary-foreground` glyph. Purely
 * presentational — no behaviour, no data.
 */
export interface LogoProps {
  /** Show the "Expense Tracker" wordmark next to the mark. */
  showWordmark?: boolean;
  /** Mark size preset. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const MARK_SIZES: Record<NonNullable<LogoProps['size']>, string> = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-9 w-9 rounded-xl',
  lg: 'h-14 w-14 rounded-2xl',
};

const GLYPH_SIZES: Record<NonNullable<LogoProps['size']>, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-8 w-8',
};

const WORDMARK_SIZES: Record<NonNullable<LogoProps['size']>, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
};

export function Logo({
  showWordmark = true,
  size = 'md',
  className,
}: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-soft ring-1 ring-inset ring-white/10',
          MARK_SIZES[size],
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={GLYPH_SIZES[size]}
          strokeWidth={2}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 6.5v11" />
        </svg>
      </span>
      {showWordmark ? (
        <span
          className={cn(
            'font-semibold tracking-tight text-foreground',
            WORDMARK_SIZES[size],
          )}
        >
          {APP_NAME}
        </span>
      ) : null}
    </span>
  );
}
