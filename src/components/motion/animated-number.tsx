'use client';

import * as React from 'react';

import { animate, useInView, useReducedMotion } from 'framer-motion';

import { useCurrency } from '@/components/providers/currency-provider';

/**
 * AnimatedNumber — counts up to `value` when scrolled into view, formatting each
 * frame. Used for hero balances and stat figures. Respects reduced-motion
 * (renders the final value immediately). `value` is a plain number (e.g. cents).
 *
 * Formatting is chosen with serializable props so a Server Component can render
 * this directly: pass `currency` to format as money, or nothing for a plain
 * rounded integer. A `format` function is still accepted, but ONLY from Client
 * Components — functions cannot cross the server→client boundary.
 */
export function AnimatedNumber({
  value,
  format,
  currency = false,
  duration = 1.1,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  currency?: boolean;
  duration?: number;
  className?: string;
}) {
  const { format: formatMoney } = useCurrency();

  // Keep the formatter in a ref so the animation effect doesn't have to list an
  // unstable function in its deps (and so a `format`/currency change is always
  // picked up without re-running the animation).
  const fmtRef = React.useRef<(n: number) => string>(() => '');
  fmtRef.current =
    format ??
    (currency
      ? (n: number) => formatMoney(Math.round(n))
      : (n: number) => String(Math.round(n)));

  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-20px' });
  // The last numeric value shown, so a re-run animates from where it left off
  // rather than snapping back to zero.
  const currentRef = React.useRef(reduce ? value : 0);

  // The server/first paint value. After mount the effect owns `textContent`.
  const initial = fmtRef.current(currentRef.current);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Reduced motion (or not yet scrolled into view): show the final value with
    // no animation.
    if (reduce || !inView) {
      currentRef.current = value;
      node.textContent = fmtRef.current(value);
      return;
    }

    // Animate by writing each frame straight to the DOM node — no React state
    // update per frame, so counting up a hero figure doesn't re-render the tree
    // ~60 times a second (this used to `setState` every frame, and several of
    // these mount on the dashboard at once).
    const controls = animate(currentRef.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        currentRef.current = latest;
        node.textContent = fmtRef.current(latest);
      },
    });
    return () => controls.stop();
    // `formatMoney` is stable per currency (memoised in the provider); listing it
    // re-syncs the text when the user changes currency.
  }, [inView, value, reduce, duration, formatMoney]);

  return (
    <span ref={ref} className={className} suppressHydrationWarning>
      {initial}
    </span>
  );
}
