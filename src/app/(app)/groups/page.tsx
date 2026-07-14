import type { Metadata } from 'next';
import Link from 'next/link';

import { Plus, Users } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { GroupCard } from '@/components/groups/group-card';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { getGroups } from '@/lib/queries/groups';

export const metadata: Metadata = { title: 'Groups' };

/**
 * Groups page (Phase 3). Server Component: reads the RLS-scoped groups the user
 * belongs to (with member counts and per-group balances) and renders them as a
 * grid of cards.
 */
export default async function GroupsPage() {
  const groups = await getGroups();

  return (
    <section className="space-y-6">
      <PageHeader
        title="Groups"
        description="Shared spaces for trips, homes, and more."
        action={
          <Button asChild>
            <Link href={ROUTES.newGroup}>
              <Plus />
              New group
            </Link>
          </Button>
        }
      />

      {groups.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No groups yet"
          description="Create a group to track shared expenses with a set of people."
          action={
            <Button asChild>
              <Link href={ROUTES.newGroup}>
                <Plus />
                New group
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <GroupCard key={group.group.id} group={group} />
          ))}
        </div>
      )}
    </section>
  );
}
