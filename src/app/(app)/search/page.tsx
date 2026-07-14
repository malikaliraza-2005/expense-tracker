import type { Metadata } from 'next';

import { PageHeader } from '@/components/common/page-header';
import { SearchBar } from '@/components/search/search-bar';
import { SearchResults } from '@/components/search/search-results';
import { requireUser } from '@/lib/auth';
import { searchFriends, searchGroups } from '@/lib/queries/search';

export const metadata: Metadata = { title: 'Search' };

/**
 * Search page (Phase 6). Server Component: reads the `?q=` query, runs the
 * RLS-scoped friend/group search, and renders the debounced search bar over the
 * results. The bar drives `?q=`, so each pause re-runs this read.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  await requireUser();
  const query = typeof searchParams.q === 'string' ? searchParams.q : '';

  const [friends, groups] = await Promise.all([
    searchFriends(query),
    searchGroups(query),
  ]);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Search"
        description="Find a friend or a group by name."
      />
      <SearchBar initialQuery={query} />
      <SearchResults query={query} friends={friends} groups={groups} />
    </section>
  );
}
