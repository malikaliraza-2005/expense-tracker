'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { Check, ChevronsUpDown, Globe, Search } from 'lucide-react';
import { toast } from 'sonner';

import { updateCurrency } from '@/actions/profile';
import { Input } from '@/components/ui/input';
import { listCurrencies, type CurrencyInfo } from '@/constants/currencies';
import { cn } from '@/utils/cn';

/**
 * Searchable worldwide currency picker. The option list is the runtime's full
 * ISO 4217 set (popular codes first), filtered live by code or name. Selecting a
 * currency persists it to the profile and refreshes so every amount re-renders
 * in the new currency.
 */
export function CurrencySelect({ current }: { current: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [pending, setPending] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const all = React.useMemo(() => listCurrencies(), []);
  const selected = all.find((c) => c.code === current);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (c) =>
        c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    );
  }, [all, query]);

  // Close on outside click / Escape.
  React.useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
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

  return (
    <div ref={rootRef} className="relative">
      <button
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

      {open ? (
        <div className="glass-strong absolute z-50 mt-2 w-full overflow-hidden rounded-xl shadow-elevated">
          <div className="border-b border-border/60 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search 150+ currencies…"
                className="h-10 pl-9"
              />
            </div>
          </div>
          <ul
            role="listbox"
            className="max-h-64 overflow-y-auto p-1.5"
            aria-label="Currencies"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                No currency matches “{query}”.
              </li>
            ) : (
              filtered.map((c: CurrencyInfo) => {
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
                        'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:bg-accent disabled:opacity-60',
                        active && 'bg-primary/10',
                      )}
                    >
                      <span className="inline-flex h-7 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-semibold">
                        {c.symbol}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{c.code}</span>
                        <span className="ml-2 truncate text-muted-foreground">
                          {c.name}
                        </span>
                      </span>
                      {pending === c.code ? (
                        <span className="text-xs text-muted-foreground">…</span>
                      ) : active ? (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
