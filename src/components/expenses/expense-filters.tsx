'use client';

import * as React from 'react';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Search, X } from 'lucide-react';

import { useDebounce } from '@/hooks/use-debounce';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { cn } from '@/utils/cn';

/** A `<option>` choice for the category / person selects. */
export interface FilterOption {
  value: string;
  label: string;
}

export interface ExpenseFiltersProps {
  sort: 'newest' | 'oldest';
  search: string;
  categoryId: string;
  memberId: string;
  status: 'all' | 'outstanding' | 'settled';
  from: string;
  to: string;
  categories: FilterOption[];
  members: FilterOption[];
}

/**
 * Expense list controls. Search, category, person, status, date-range, and sort
 * are all mirrored into the URL query string so the Server Component re-reads
 * and applies them — the URL is the single source of filter truth, which keeps
 * results shareable and survives refresh/back. The free-text search is debounced
 * so typing fires one navigation per pause, not per keystroke.
 */
export function ExpenseFilters({
  sort,
  search,
  categoryId,
  memberId,
  status,
  from,
  to,
  categories,
  members,
}: ExpenseFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  // The search box is controlled locally for responsiveness; its debounced
  // value is what actually drives the URL.
  const [searchInput, setSearchInput] = React.useState(search);
  const debouncedSearch = useDebounce(searchInput, 350);
  const didMount = React.useRef(false);

  const pushParams = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      });
    },
    [pathname, router, searchParams],
  );

  const setParam = React.useCallback(
    (key: string, value: string) => {
      pushParams((params) => {
        if (!value) params.delete(key);
        else params.set(key, value);
      });
    },
    [pushParams],
  );

  // Sync the debounced search term into the URL (skip the initial mount so we
  // don't fire a redundant navigation on load).
  React.useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    setParam('q', debouncedSearch.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const hasActiveFilters =
    Boolean(search || categoryId || memberId || from || to) ||
    status !== 'all';

  function clearAll() {
    setSearchInput('');
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/50 bg-background/30 p-3 backdrop-blur-sm">
      {/* Search — full width, always visible. */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search by title, description, or note…"
          aria-label="Search expenses"
          className="pl-9"
        />
      </div>

      {/* Filter row — wraps on small screens. */}
      <div className="flex flex-wrap items-end gap-3">
        <FilterField label="Category" htmlFor="filter-category">
          <Select
            id="filter-category"
            value={categoryId}
            onChange={(event) => setParam('cat', event.target.value)}
            disabled={isPending}
            className="h-9"
          >
            <option value="">All categories</option>
            {categories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FilterField>

        <FilterField label="Person" htmlFor="filter-person">
          <Select
            id="filter-person"
            value={memberId}
            onChange={(event) => setParam('who', event.target.value)}
            disabled={isPending}
            className="h-9"
          >
            <option value="">Anyone</option>
            {members.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FilterField>

        <FilterField label="Status" htmlFor="filter-status">
          <Select
            id="filter-status"
            value={status}
            onChange={(event) => setParam('status', event.target.value)}
            disabled={isPending}
            className="h-9"
          >
            <option value="all">All</option>
            <option value="outstanding">Outstanding</option>
            <option value="settled">Settled</option>
          </Select>
        </FilterField>

        <FilterField label="From" htmlFor="filter-from">
          <DatePicker
            id="filter-from"
            value={from}
            max={to || undefined}
            onChange={(iso) => setParam('from', iso)}
            disabled={isPending}
            aria-label="From date"
          />
        </FilterField>

        <FilterField label="To" htmlFor="filter-to">
          <DatePicker
            id="filter-to"
            value={to}
            min={from || undefined}
            onChange={(iso) => setParam('to', iso)}
            disabled={isPending}
            aria-label="To date"
          />
        </FilterField>

        <FilterField label="Sort" htmlFor="filter-sort">
          <Select
            id="filter-sort"
            value={sort}
            onChange={(event) => setParam('sort', event.target.value)}
            disabled={isPending}
            className="h-9 w-36"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </Select>
        </FilterField>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearAll}
            disabled={isPending}
            className={cn(
              'inline-flex h-9 items-center gap-1 rounded-lg border border-border/60 bg-background/40 px-3 text-sm font-medium text-muted-foreground outline-none transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

function FilterField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label
        htmlFor={htmlFor}
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}
