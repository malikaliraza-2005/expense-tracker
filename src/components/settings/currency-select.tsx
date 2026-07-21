'use client';

import * as React from 'react';

import { createPortal } from 'react-dom';

import { useRouter } from 'next/navigation';

import { Check, ChevronsUpDown, Globe, Search } from 'lucide-react';
import { toast } from 'sonner';

import { updateCurrency } from '@/actions/profile';
import { Input } from '@/components/ui/input';
import {
  listCurrencies,
  POPULAR_CURRENCIES,
  type CurrencyInfo,
} from '@/constants/currencies';
import { cn } from '@/utils/cn';

/**
 * Searchable worldwide currency picker. The option list is the runtime's full
 * ISO 4217 set (popular codes first), filtered live by code or name. Selecting a
 * currency persists it to the profile and refreshes so every amount re-renders
 * in the new currency.
 *
 * The open panel is rendered through a portal to `document.body`. This is
 * deliberate: every `Card` uses `backdrop-filter` (`.glass`), which creates a
 * stacking context, so an in-flow popover is trapped inside its card and paints
 * *behind* later sibling cards regardless of its `z-index`. Portalling escapes
 * those contexts entirely — the panel reliably sits above sibling cards and the
 * fixed bottom nav. On phones it's a modal bottom sheet that locks background
 * scroll; on `sm+` it's a popover anchored to the trigger's measured rect.
 */
export function CurrencySelect({ current }: { current: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [pending, setPending] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const [isDesktop, setIsDesktop] = React.useState(false);
  const [anchor, setAnchor] = React.useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const all = React.useMemo(() => listCurrencies(), []);
  const selected = all.find((c) => c.code === current);

  const q = query.trim().toLowerCase();
  const filtered = React.useMemo(() => {
    if (!q) return all;
    return all.filter(
      (c) =>
        c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    );
  }, [all, q]);

  // With no search, surface the common currencies under a "Popular" heading and
  // the rest under "All currencies", so frequent choices are one glance away
  // without hiding the full worldwide list. While searching, show a flat list.
  const popularSet = React.useMemo(
    () => new Set(POPULAR_CURRENCIES as readonly string[]),
    [],
  );
  const grouped = q === '';
  const popularList = React.useMemo(
    () => all.filter((c) => popularSet.has(c.code)),
    [all, popularSet],
  );
  const restList = React.useMemo(
    () => all.filter((c) => !popularSet.has(c.code)),
    [all, popularSet],
  );

  // Portals need the DOM; only render them after mount.
  React.useEffect(() => setMounted(true), []);

  // Track the breakpoint so we can pick the sheet vs. popover layout (and only
  // scroll-lock on phones). `sm` = 640px in Tailwind's default scale.
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Position the desktop popover under the trigger, keeping it aligned while the
  // page scrolls or resizes. Measured in a layout effect to avoid a flash.
  const measure = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setAnchor({ left: r.left, top: r.bottom, width: r.width });
  }, []);

  React.useLayoutEffect(() => {
    if (!open || !isDesktop) return;
    measure();
    // Coalesce scroll/resize bursts into one measurement per animation frame:
    // reading `getBoundingClientRect()` synchronously on every scroll event
    // forces a layout each time (layout thrash). rAF batches it to ~60/sec max.
    let frame: number | null = null;
    const onReflow = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        measure();
      });
    };
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [open, isDesktop, measure]);

  // Close on outside click (trigger + panel both count as "inside") / Escape.
  React.useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Lock background scroll while the mobile sheet is open so the page (and the
  // bottom nav beneath the backdrop) can't scroll under it. Popover leaves scroll
  // free on desktop.
  React.useEffect(() => {
    if (!open || isDesktop) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, isDesktop]);

  const renderOption = (c: CurrencyInfo) => {
    const active = c.code === current;
    return (
      <li key={c.code}>
        <button
          type="button"
          role="option"
          aria-selected={active}
          disabled={pending !== null}
          onClick={() => choose(c.code)}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:bg-accent disabled:opacity-60',
            active && 'bg-primary/10',
          )}
        >
          <span className="inline-flex h-8 w-10 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-semibold">
            {c.symbol}
          </span>
          <span className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="font-medium">{c.code}</span>
            <span className="truncate text-muted-foreground">{c.name}</span>
          </span>
          {pending === c.code ? (
            <span className="text-xs text-muted-foreground">…</span>
          ) : active ? (
            <Check className="h-4 w-4 shrink-0 text-primary" />
          ) : null}
        </button>
      </li>
    );
  };

  function choose(code: string) {
    if (code === current) {
      setOpen(false);
      return;
    }
    setPending(code);
    updateCurrency({ currency: code }).then((result) => {
      setPending(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Currency set to ${code}.`);
      setOpen(false);
      setQuery('');
      router.refresh();
    });
  }

  // The search box + option list, shared by both layouts.
  const body = (
    <>
      <div className="shrink-0 border-b border-border/60 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search 150+ currencies…"
            className="h-10 pl-9"
            aria-label="Search currencies"
          />
        </div>
      </div>
      <ul
        role="listbox"
        aria-label="Currencies"
        className="flex-1 overflow-y-auto overscroll-contain p-1.5"
      >
        {grouped ? (
          <>
            <GroupLabel>Popular</GroupLabel>
            {popularList.map(renderOption)}
            <GroupLabel>All currencies</GroupLabel>
            {restList.map(renderOption)}
          </>
        ) : filtered.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            No currency matches “{query}”.
          </li>
        ) : (
          filtered.map(renderOption)
        )}
      </ul>
    </>
  );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center gap-2 rounded-lg border border-input bg-background/60 px-3.5 text-left text-sm shadow-inner-top backdrop-blur-sm transition-all duration-200 hover:border-primary/40 focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <Globe className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="font-semibold">{selected?.code ?? current}</span>
          <span className="truncate text-muted-foreground">
            {selected ? selected.name : ''}
          </span>
        </span>
        <span className="shrink-0 text-muted-foreground">
          {selected?.symbol}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && mounted
        ? createPortal(
            isDesktop ? (
              // Desktop: popover anchored to the trigger's rect. Portalled to
              // body so it clears sibling cards' stacking contexts.
              anchor ? (
                <div
                  ref={panelRef}
                  role="dialog"
                  aria-label="Select currency"
                  className="glass-strong fixed z-[70] flex max-h-[min(24rem,calc(100dvh-2rem))] flex-col overflow-hidden rounded-xl shadow-elevated"
                  style={{
                    left: anchor.left,
                    top: anchor.top + 8,
                    width: anchor.width,
                  }}
                >
                  {body}
                </div>
              ) : null
            ) : (
              // Mobile: modal bottom sheet + backdrop, both above the nav.
              <>
                <div
                  className="fixed inset-0 z-[60] bg-background/70 backdrop-blur-sm"
                  aria-hidden
                  onClick={() => setOpen(false)}
                />
                <div
                  ref={panelRef}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Select currency"
                  className="glass-strong fixed inset-x-0 bottom-0 z-[70] flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl shadow-elevated"
                  style={{
                    paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)',
                  }}
                >
                  <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
                  {body}
                </div>
              </>
            ),
            document.body,
          )
        : null}
    </div>
  );
}

/** Small section heading separating "Popular" from "All currencies". */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <li
      role="presentation"
      className="sticky top-0 z-10 bg-background/80 px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm first:pt-1"
    >
      {children}
    </li>
  );
}
