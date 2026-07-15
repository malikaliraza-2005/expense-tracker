import * as React from 'react';

import { cn } from '@/utils/cn';

/**
 * Reveal — a lightweight entrance animation (fade + rise) implemented in pure
 * CSS, so it ships zero client JS and stays a Server Component. `delay` staggers
 * siblings. Reduced-motion users get an instant, static render (the animation is
 * gated behind `motion-safe`, and the content sits at its natural opacity
 * without it). Renders a `div`.
 *
 * Previously a framer-motion `motion.div`; moved to CSS to drop framer-motion
 * from routes that only needed an entrance effect.
 */
export function Reveal({
  delay = 0,
  className,
  children,
}: {
  delay?: number;
  /** Retained for API compatibility; the CSS keyframe rises a fixed distance. */
  y?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn('motion-safe:animate-fade-in-up', className)}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
