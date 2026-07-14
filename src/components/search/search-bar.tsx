'use client';

import * as React from 'react';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';

/**
 * Search input (Client Component). Reflects the query into the `?q=` param
 * (debounced) so the Server Component re-reads friends/groups. Seeded from the
 * current param so a shared/reloaded URL shows the same search.
 */
export function SearchBar({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [value, setValue] = React.useState(initialQuery);
  const debounced = useDebounce(value, 300);

  // Push the debounced value into the URL when it diverges from the param.
  React.useEffect(() => {
    const current = searchParams.get('q') ?? '';
    if (debounced === current) return;

    const params = new URLSearchParams(searchParams.toString());
    if (debounced.trim()) params.set('q', debounced);
    else params.delete('q');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [debounced, pathname, router, searchParams]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search friends and groups"
        aria-label="Search friends and groups"
        className="pl-9"
        autoFocus
      />
    </div>
  );
}
