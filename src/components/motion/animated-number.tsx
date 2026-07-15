'use client';

import * as React from 'react';

import {
  animate,
  useInView,
  useMotionValue,
  useReducedMotion,
} from 'framer-motion';

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
  const fmt =
    format ??
    (currency
      ? (n: number) => formatMoney(Math.round(n))
      : (n: number) => String(Math.round(n)));

  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-20px' });
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = React.useState(() => fmt(reduce ? value : 0));

  React.useEffect(() => {
    if (reduce) {
      setDisplay(fmt(value));
      return;
    }
    if (!inView) return;
    const controls = animate(motionValue, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(fmt(latest)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value, reduce, duration, currency]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
