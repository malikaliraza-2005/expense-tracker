'use client';

import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/utils/cn';

export interface BarDatum {
  label: string;
  value: number;
  /** Optional per-bar CSS colour; defaults to the neon gradient. */
  color?: string;
}

/**
 * Animated vertical bar chart (e.g. spending by period). Bars grow from the
 * baseline on mount with a staggered spring. Values are normalised to the max.
 * Theme-aware and reduced-motion friendly.
 */
export function BarChart({
  data,
  height = 160,
  className,
  formatValue,
}: {
  data: BarDatum[];
  height?: number;
  className?: string;
  formatValue?: (n: number) => string;
}) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div
      className={cn('flex items-end justify-between gap-2', className)}
      style={{ height }}
    >
      {data.map((datum, index) => {
        const pct = (datum.value / max) * 100;
        return (
          <div
            key={`${datum.label}-${index}`}
            className="group flex h-full flex-1 flex-col items-center justify-end gap-2"
          >
            <div className="relative flex w-full flex-1 items-end justify-center">
              {formatValue ? (
                <span className="absolute -top-0 select-none text-[10px] font-medium tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  {formatValue(datum.value)}
                </span>
              ) : null}
              <motion.div
                className="w-full max-w-[2rem] rounded-t-md shadow-glow-sm"
                style={{
                  background:
                    datum.color ??
                    'linear-gradient(180deg, hsl(var(--primary)), hsl(var(--cyan)))',
                }}
                initial={reduce ? { height: `${pct}%` } : { height: 0 }}
                whileInView={{ height: `${pct}%` }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.7,
                  ease: [0.16, 1, 0.3, 1],
                  delay: index * 0.06,
                }}
              />
            </div>
            <span className="truncate text-[10px] font-medium text-muted-foreground">
              {datum.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
