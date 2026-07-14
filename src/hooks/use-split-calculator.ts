'use client';

import * as React from 'react';

import { computeSplit, type SplitShare } from '@/lib/splits';
import type { SplitType } from '@/types/db';

/**
 * Live split preview (Phase 4). Reuses the pure split engine (lib/splits.ts) —
 * the exact same code the server runs — so the form previews precisely what will
 * be persisted, and validity is decided by one source of truth. No I/O; recompute
 * is cheap.
 */

export interface SplitCalculatorInput {
  amountCents: number;
  splitType: SplitType;
  participantIds: string[];
  /** userId → integer cents (exact split). */
  exactCentsById: Record<string, number>;
  /** userId → percent (percentage split). */
  percentById: Record<string, number>;
}

export interface SplitCalculatorResult {
  /** Resolved shares (empty when the current inputs are invalid). */
  shares: SplitShare[];
  /** userId → resolved share in cents, for per-row display. */
  sharesById: Record<string, number>;
  isValid: boolean;
  /** Actionable message when invalid (from the split engine), else null. */
  error: string | null;
  /** Sum of the exact inputs (exact split), for the running total UI. */
  allocatedCents: number;
  /** Total − allocated (exact split); 0 when it reconciles. */
  remainingCents: number;
  /** Sum of the percentage inputs (percentage split). */
  totalPercent: number;
}

export function useSplitCalculator(
  input: SplitCalculatorInput,
): SplitCalculatorResult {
  const { amountCents, splitType, participantIds, exactCentsById, percentById } =
    input;

  return React.useMemo(() => {
    const allocatedCents = participantIds.reduce(
      (sum, id) => sum + (exactCentsById[id] ?? 0),
      0,
    );
    const totalPercent = participantIds.reduce(
      (sum, id) => sum + (percentById[id] ?? 0),
      0,
    );
    const remainingCents = amountCents - allocatedCents;

    const result =
      splitType === 'equal'
        ? computeSplit({ type: 'equal', amountCents, userIds: participantIds })
        : splitType === 'exact'
          ? computeSplit({
              type: 'exact',
              amountCents,
              shares: participantIds.map((id) => ({
                userId: id,
                shareCents: exactCentsById[id] ?? 0,
              })),
            })
          : computeSplit({
              type: 'percentage',
              amountCents,
              weights: participantIds.map((id) => ({
                userId: id,
                percent: percentById[id] ?? 0,
              })),
            });

    if (!result.ok) {
      return {
        shares: [],
        sharesById: {},
        isValid: false,
        error: result.error,
        allocatedCents,
        remainingCents,
        totalPercent,
      };
    }

    const sharesById: Record<string, number> = {};
    for (const share of result.shares) sharesById[share.userId] = share.shareCents;

    return {
      shares: result.shares,
      sharesById,
      isValid: true,
      error: null,
      allocatedCents,
      remainingCents,
      totalPercent,
    };
  }, [amountCents, splitType, participantIds, exactCentsById, percentById]);
}
