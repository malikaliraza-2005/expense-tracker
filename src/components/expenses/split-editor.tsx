'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  DEFAULT_SPLIT_TYPE,
  SPLIT_TYPES,
} from '@/constants/split-types';
import { useSplitCalculator } from '@/hooks/use-split-calculator';
import type { SplitInputWire } from '@/schemas/expense.schema';
import type { Person } from '@/components/expenses/payer-select';
import type { SplitType } from '@/types/db';
import { centsToDecimal, formatCents, parseAmountToCents } from '@/utils/money';

/** What the editor reports up to the form on every change. */
export interface SplitEditorValue {
  wire: SplitInputWire;
  isValid: boolean;
  error: string | null;
}

export interface SplitEditorInitial {
  splitType: SplitType;
  participants: Array<{ userId: string; shareCents: number }>;
}

interface SplitEditorProps {
  people: Person[];
  amountCents: number;
  initial?: SplitEditorInitial;
  onChange: (value: SplitEditorValue) => void;
}

function initialSelection(
  people: Person[],
  initial: SplitEditorInitial | undefined,
): Record<string, boolean> {
  const selected: Record<string, boolean> = {};
  const initialIds = initial
    ? new Set(initial.participants.map((p) => p.userId))
    : null;
  for (const person of people) {
    // Create: pre-select everyone (equal is the common case). Edit: restore.
    selected[person.id] = initialIds ? initialIds.has(person.id) : true;
  }
  return selected;
}

/**
 * Split editor (Phase 4). Lets the user choose a split type and configure each
 * participant's share, with a LIVE preview and validation driven by the pure
 * split engine (via useSplitCalculator) — the same code the server runs, so what
 * you see is exactly what gets saved. Reports the wire split and its validity to
 * the parent form on every change.
 *
 * - Equal: pick participants; the total is divided evenly (remainder handled).
 * - Exact: enter each share; must add up to the total.
 * - Percentage: enter each percentage; must add up to 100%.
 */
export function SplitEditor({
  people,
  amountCents,
  initial,
  onChange,
}: SplitEditorProps) {
  const [splitType, setSplitType] = React.useState<SplitType>(
    initial?.splitType ?? DEFAULT_SPLIT_TYPE,
  );
  const [selected, setSelected] = React.useState<Record<string, boolean>>(() =>
    initialSelection(people, initial),
  );

  const initialShareById = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const p of initial?.participants ?? []) map.set(p.userId, p.shareCents);
    return map;
  }, [initial]);

  const [exactInput, setExactInput] = React.useState<Record<string, string>>(
    () => {
      const values: Record<string, string> = {};
      if (initial?.splitType === 'exact') {
        for (const p of initial.participants) {
          values[p.userId] = String(centsToDecimal(p.shareCents));
        }
      }
      return values;
    },
  );

  const [percentInput, setPercentInput] = React.useState<
    Record<string, string>
  >(() => {
    const values: Record<string, string> = {};
    if (initial?.splitType === 'percentage') {
      const total = initial.participants.reduce(
        (sum, p) => sum + p.shareCents,
        0,
      );
      for (const p of initial.participants) {
        values[p.userId] =
          total > 0
            ? String(Math.round((p.shareCents / total) * 10000) / 100)
            : '';
      }
    }
    return values;
  });

  const participantIds = people
    .filter((person) => selected[person.id])
    .map((person) => person.id);

  const exactCentsById: Record<string, number> = {};
  for (const id of participantIds) {
    exactCentsById[id] = parseAmountToCents(exactInput[id] ?? '');
  }

  const percentById: Record<string, number> = {};
  for (const id of participantIds) {
    const value = Number(percentInput[id]);
    percentById[id] = Number.isFinite(value) ? value : 0;
  }

  const calc = useSplitCalculator({
    amountCents,
    splitType,
    participantIds,
    exactCentsById,
    percentById,
  });

  // Build the wire payload the server action expects.
  const wire: SplitInputWire = React.useMemo(() => {
    if (splitType === 'equal') return { type: 'equal', participantIds };
    if (splitType === 'exact') {
      return {
        type: 'exact',
        shares: participantIds.map((id) => ({
          userId: id,
          amountCents: exactCentsById[id] ?? 0,
        })),
      };
    }
    return {
      type: 'percentage',
      shares: participantIds.map((id) => ({
        userId: id,
        percent: percentById[id] ?? 0,
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitType, JSON.stringify(participantIds), JSON.stringify(exactCentsById), JSON.stringify(percentById)]);

  const wireKey = JSON.stringify(wire);
  React.useEffect(() => {
    onChange({ wire, isValid: calc.isValid, error: calc.error });
    // wireKey captures wire content; calc validity derives from the same inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wireKey, calc.isValid, calc.error, onChange]);

  function toggle(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="split-type">Split</Label>
        <Select
          id="split-type"
          value={splitType}
          onChange={(event) => setSplitType(event.target.value as SplitType)}
        >
          {SPLIT_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <p className="text-sm text-muted-foreground">
          {SPLIT_TYPES.find((o) => o.value === splitType)?.hint}
        </p>
      </div>

      <ul className="space-y-2 rounded-md border p-3">
        {people.map((person) => {
          const isSelected = Boolean(selected[person.id]);
          const share = calc.sharesById[person.id] ?? 0;
          return (
            <li
              key={person.id}
              className="flex flex-wrap items-center gap-3 text-sm"
            >
              <label className="flex flex-1 items-center gap-2">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(person.id)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="truncate">{person.name}</span>
              </label>

              {isSelected && splitType === 'exact' ? (
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  aria-label={`${person.name} amount`}
                  value={exactInput[person.id] ?? ''}
                  onChange={(event) =>
                    setExactInput((prev) => ({
                      ...prev,
                      [person.id]: event.target.value,
                    }))
                  }
                  className="h-8 w-28"
                />
              ) : null}

              {isSelected && splitType === 'percentage' ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    max="100"
                    aria-label={`${person.name} percentage`}
                    value={percentInput[person.id] ?? ''}
                    onChange={(event) =>
                      setPercentInput((prev) => ({
                        ...prev,
                        [person.id]: event.target.value,
                      }))
                    }
                    className="h-8 w-20"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              ) : null}

              <span className="w-20 text-right tabular-nums text-muted-foreground">
                {isSelected ? formatCents(share) : '—'}
              </span>
            </li>
          );
        })}
      </ul>

      <SplitSummary
        splitType={splitType}
        amountCents={amountCents}
        allocatedCents={calc.allocatedCents}
        remainingCents={calc.remainingCents}
        totalPercent={calc.totalPercent}
        isValid={calc.isValid}
        error={calc.error}
      />
    </div>
  );
}

/** The running total / validation line under the participant list. */
function SplitSummary({
  splitType,
  amountCents,
  allocatedCents,
  remainingCents,
  totalPercent,
  isValid,
  error,
}: {
  splitType: SplitType;
  amountCents: number;
  allocatedCents: number;
  remainingCents: number;
  totalPercent: number;
  isValid: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-1 text-sm">
      {splitType === 'exact' ? (
        <div className="flex justify-between tabular-nums">
          <span className="text-muted-foreground">
            {formatCents(allocatedCents)} of {formatCents(amountCents)} assigned
          </span>
          <span
            className={
              remainingCents === 0 ? 'text-muted-foreground' : 'text-destructive'
            }
          >
            {remainingCents === 0
              ? 'Balanced'
              : `${formatCents(Math.abs(remainingCents))} ${remainingCents > 0 ? 'left' : 'over'}`}
          </span>
        </div>
      ) : null}

      {splitType === 'percentage' ? (
        <div className="flex justify-between tabular-nums">
          <span className="text-muted-foreground">
            {totalPercent}% assigned
          </span>
          <span
            className={
              Math.abs(totalPercent - 100) < 1e-6
                ? 'text-muted-foreground'
                : 'text-destructive'
            }
          >
            {Math.abs(totalPercent - 100) < 1e-6
              ? 'Balanced'
              : `${Math.abs(100 - totalPercent)}% ${totalPercent < 100 ? 'left' : 'over'}`}
          </span>
        </div>
      ) : null}

      {!isValid && error ? (
        <p className="text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
