'use client';

import * as React from 'react';

import { createPortal } from 'react-dom';

import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

import { DEFAULT_LOCALE } from '@/constants/app';
import { cn } from '@/utils/cn';

/**
 * A dependency-free, accessible date picker. Shows a friendly formatted value on
 * a trigger button; opening reveals a month-grid calendar with prev/next month
 * navigation, `min`/`max` bounds (out-of-range days are disabled), and Today /
 * Clear shortcuts. Values cross the boundary as ISO `yyyy-mm-dd` strings so it
 * drops in wherever a native date input was used.
 *
 * The calendar popup is rendered through a portal to `document.body` with fixed
 * positioning derived from the trigger's rect. That keeps it out of any
 * ancestor's `overflow`/`backdrop-filter` stacking context, so it is never
 * clipped by a scroll container nor painted under the sticky header or the fixed
 * mobile bottom nav. Placement flips above/below and is clamped to the viewport,
 * and the panel scrolls internally when vertical space is tight — so it stays
 * fully visible on small screens. The month grid is fully keyboard navigable via
 * a roving tabindex (arrows, Home/End, PageUp/PageDown, Enter/Space, Escape).
 */
export interface DatePickerProps {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Gap between the trigger and the panel, and the min gutter to the viewport. */
const GAP = 8;
const MARGIN = 8;
const PANEL_WIDTH = 288; // matches the previous `w-72`

/** Parse a `yyyy-mm-dd` string to a local Date, or null. */
function parseISO(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Format a local Date to `yyyy-mm-dd`. */
function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

interface PanelStyle {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  id,
  placeholder = 'Any date',
  disabled,
  'aria-label': ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const selected = parseISO(value);
  const minDate = min ? parseISO(min) : null;
  const maxDate = max ? parseISO(max) : null;

  // The month currently shown. Seeded from the value (or today) and re-seeded
  // whenever the popover opens so it always lands on a relevant month.
  const [view, setView] = React.useState(() => selected ?? new Date());

  // The focused day within the grid (roving tabindex). Kept in sync with `view`
  // so keyboard navigation across a month boundary follows the visible grid.
  const [active, setActive] = React.useState<Date | null>(null);

  // Fixed-position coordinates for the portalled panel, recomputed from the
  // trigger's rect on open and on scroll/resize.
  const [panelStyle, setPanelStyle] = React.useState<PanelStyle | null>(null);

  React.useEffect(() => {
    if (open) {
      const seed = parseISO(value) ?? new Date();
      setView(seed);
      setActive(seed);
    }
  }, [open, value]);

  const outOfRange = React.useCallback(
    (date: Date): boolean => {
      if (minDate) {
        const floor = new Date(minDate);
        floor.setHours(0, 0, 0, 0);
        if (date < floor) return true;
      }
      if (maxDate) {
        const ceil = new Date(maxDate);
        ceil.setHours(23, 59, 59, 999);
        if (date > ceil) return true;
      }
      return false;
    },
    [minDate, maxDate],
  );

  // Position the panel: prefer below the trigger, flip above when short on
  // space, clamp horizontally into the viewport, and cap the height so the
  // panel scrolls internally instead of running off-screen.
  const reposition = React.useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(PANEL_WIDTH, vw - MARGIN * 2);
    const contentHeight = panel.scrollHeight;

    const spaceBelow = vh - rect.bottom - GAP - MARGIN;
    const spaceAbove = rect.top - GAP - MARGIN;
    const placeBelow = spaceBelow >= contentHeight || spaceBelow >= spaceAbove;

    const available = Math.max(160, placeBelow ? spaceBelow : spaceAbove);
    const maxHeight = Math.min(contentHeight, available);
    const top = placeBelow
      ? rect.bottom + GAP
      : Math.max(MARGIN, rect.top - GAP - maxHeight);

    let left = rect.left;
    left = Math.min(left, vw - width - MARGIN);
    left = Math.max(MARGIN, left);

    setPanelStyle({ top, left, width, maxHeight });
  }, []);

  // Recompute before paint so the panel never flashes at the wrong spot, and
  // keep it pinned to the trigger while the user scrolls or resizes.
  React.useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const handler = () => reposition();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open, view, active, reposition]);

  // Close on outside click / Escape (restoring focus to the trigger on Escape).
  React.useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Move DOM focus onto the active day whenever it (or the visible month)
  // changes, so arrow-key navigation is actually followed by the caret.
  React.useEffect(() => {
    if (!open || !active) return;
    const node = panelRef.current?.querySelector<HTMLButtonElement>(
      '[data-active="true"]',
    );
    node?.focus();
  }, [open, active, view]);

  const label = selected
    ? new Intl.DateTimeFormat(DEFAULT_LOCALE, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(selected)
    : '';

  const monthLabel = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    month: 'long',
    year: 'numeric',
  }).format(view);

  const firstOfMonth = new Date(view.getFullYear(), view.getMonth(), 1);
  const leadingBlanks = firstOfMonth.getDay();
  const daysInMonth = new Date(
    view.getFullYear(),
    view.getMonth() + 1,
    0,
  ).getDate();

  const cells: Array<Date | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1),
    ),
  ];

  const today = new Date();

  function pick(date: Date) {
    if (outOfRange(date)) return;
    onChange(toISO(date));
    setOpen(false);
    triggerRef.current?.focus();
  }

  function shiftMonth(delta: number) {
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));
  }

  // Move the roving focus by a number of days (or whole months), re-seeding the
  // visible month when the target leaves it.
  function moveActive(next: Date) {
    if (!sameMonth(next, view)) {
      setView(new Date(next.getFullYear(), next.getMonth(), 1));
    }
    setActive(next);
  }

  function onGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!active) return;
    const base = active;
    let next: Date | null = null;
    switch (event.key) {
      case 'ArrowLeft':
        next = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1);
        break;
      case 'ArrowRight':
        next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
        break;
      case 'ArrowUp':
        next = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 7);
        break;
      case 'ArrowDown':
        next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7);
        break;
      case 'Home':
        next = new Date(
          base.getFullYear(),
          base.getMonth(),
          base.getDate() - base.getDay(),
        );
        break;
      case 'End':
        next = new Date(
          base.getFullYear(),
          base.getMonth(),
          base.getDate() + (6 - base.getDay()),
        );
        break;
      case 'PageUp':
        next = new Date(base.getFullYear(), base.getMonth() - 1, base.getDate());
        break;
      case 'PageDown':
        next = new Date(base.getFullYear(), base.getMonth() + 1, base.getDate());
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        pick(base);
        return;
      default:
        return;
    }
    if (next) {
      event.preventDefault();
      moveActive(next);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-9 w-[10.5rem] items-center gap-2 rounded-lg border border-input bg-background/60 px-3 text-left text-sm shadow-inner-top backdrop-blur-sm transition-all duration-200 hover:border-primary/40 focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span
          className={cn(
            'flex-1 truncate',
            !label && 'text-muted-foreground/70',
          )}
        >
          {label || placeholder}
        </span>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear date"
            onClick={(event) => {
              event.stopPropagation();
              onChange('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onChange('');
              }
            }}
            className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:h-3.5 [&_svg]:w-3.5"
          >
            <X />
          </span>
        ) : null}
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="false"
              aria-label="Choose a date"
              style={{
                position: 'fixed',
                top: panelStyle?.top ?? 0,
                left: panelStyle?.left ?? 0,
                width: panelStyle?.width ?? PANEL_WIDTH,
                maxHeight: panelStyle?.maxHeight,
                overflowY: 'auto',
                visibility: panelStyle ? 'visible' : 'hidden',
              }}
              className="glass-strong z-50 rounded-xl p-3 shadow-elevated"
            >
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => shiftMonth(-1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:h-4 [&_svg]:w-4"
                >
                  <ChevronLeft />
                </button>
                <span className="text-sm font-semibold">{monthLabel}</span>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => shiftMonth(1)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:h-4 [&_svg]:w-4"
                >
                  <ChevronRight />
                </button>
              </div>

              <div
                role="grid"
                onKeyDown={onGridKeyDown}
                className="grid grid-cols-7 gap-0.5"
              >
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    role="columnheader"
                    className="py-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
                {cells.map((date, index) => {
                  if (!date) return <div key={`blank-${index}`} />;
                  const isSelected = selected && sameDay(date, selected);
                  const isToday = sameDay(date, today);
                  const isActive = active && sameDay(date, active);
                  const disabledDay = outOfRange(date);
                  return (
                    <button
                      key={toISO(date)}
                      type="button"
                      disabled={disabledDay}
                      tabIndex={isActive ? 0 : -1}
                      data-active={isActive ? 'true' : undefined}
                      aria-pressed={Boolean(isSelected)}
                      aria-current={isToday ? 'date' : undefined}
                      onClick={() => pick(date)}
                      className={cn(
                        'inline-flex h-9 items-center justify-center rounded-md text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-30',
                        isSelected
                          ? 'bg-primary font-semibold text-primary-foreground'
                          : 'hover:bg-accent',
                        !isSelected &&
                          isToday &&
                          'ring-1 ring-inset ring-primary/40',
                      )}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    if (!outOfRange(now)) pick(now);
                    else setView(new Date());
                  }}
                  className="rounded-md px-2 py-1 text-xs font-medium text-primary outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Clear
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
