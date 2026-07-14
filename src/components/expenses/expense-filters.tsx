'use client';

import * as React from 'react';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

/**
 * Expense list controls (Phase 4). For now this is the date-sort control,
 * reflected in the `?sort=` query param so the Server Component re-reads. The
 * layout is deliberately a toolbar so Phase 6 can slot in category / member /
 * amount filters beside it without a redesign.
 */
export function ExpenseFilters({ sort }: { sort: 'newest' | 'oldest' }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  function onSortChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'newest') params.delete('sort');
    else params.set('sort', value);
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="expense-sort" className="text-sm text-muted-foreground">
        Sort
      </Label>
      <Select
        id="expense-sort"
        value={sort}
        onChange={(event) => onSortChange(event.target.value)}
        disabled={isPending}
        className="h-9 w-40"
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
      </Select>
    </div>
  );
}
