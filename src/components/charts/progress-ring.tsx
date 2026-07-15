'use client';

import * as React from 'react';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * Animated circular progress ring (e.g. share settled, savings toward a goal).
 * Sweeps from 0 to `value`% on mount. Colour is token-based so it fits the neon
 * theme; the centre holds optional label/value content.
 */
export function ProgressRing({
  value,
  size = 120,
  thickness = 10,
  color = 'hsl(var(--primary))',
  trackColor = 'hsl(var(--muted))',
  children,
}: {
  /** 0–100. */
  value: number;
  size?: number;
  thickness?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={thickness}
          opacity={0.5}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={reduce ? { strokeDashoffset: offset } : { strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: offset }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          style={{ filter: 'drop-shadow(0 0 6px hsl(var(--glow) / 0.5))' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}
