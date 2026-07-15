'use client';

import * as React from 'react';

import { motion, useReducedMotion } from 'framer-motion';

export interface DonutSegment {
  label: string;
  /** Positive magnitude; segments are drawn proportional to the total. */
  value: number;
  /** Any CSS colour, e.g. `hsl(var(--primary))`. */
  color: string;
}

/**
 * Animated SVG donut chart. Segments sweep in on mount; the centre slot holds a
 * headline figure (e.g. the total). Purely presentational and theme-aware — pass
 * token-based colours so it adapts to light/dark. Reduced-motion renders static.
 */
export function DonutChart({
  segments,
  size = 180,
  thickness = 18,
  centerLabel,
  centerValue,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);

  let offsetAcc = 0;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={thickness}
          opacity={0.5}
        />
        {total > 0 &&
          segments.map((segment, index) => {
            const fraction = Math.max(0, segment.value) / total;
            const dash = fraction * circumference;
            const gap = circumference - dash;
            const rotation = (offsetAcc / total) * 360;
            offsetAcc += Math.max(0, segment.value);

            return (
              <motion.circle
                key={`${segment.label}-${index}`}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={thickness}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${gap}`}
                style={{
                  transformOrigin: 'center',
                  transform: `rotate(${rotation}deg)`,
                }}
                initial={reduce ? undefined : { strokeDashoffset: dash }}
                animate={{ strokeDashoffset: 0 }}
                transition={{
                  duration: 0.9,
                  ease: [0.16, 1, 0.3, 1],
                  delay: 0.1 + index * 0.12,
                }}
              />
            );
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {centerValue ? (
          <span className="text-xl font-semibold tabular-nums">
            {centerValue}
          </span>
        ) : null}
        {centerLabel ? (
          <span className="mt-0.5 text-xs text-muted-foreground">
            {centerLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
