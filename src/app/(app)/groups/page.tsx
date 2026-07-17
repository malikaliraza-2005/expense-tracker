import type { Metadata } from 'next';
import Link from 'next/link';

import { Users2 } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { BalanceLabel } from '@/components/common/money';
import { PageHeader } from '@/components/common/page-header';
import { CreateGroupDialog } from '@/components/groups/create-group-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { groupTypeLabel } from '@/constants/group-types';
import { ROUTES } from '@/constants/routes';
import { requireUser } from '@/lib/auth';
import { listGroups } from '@/lib/queries/groups';

export const metadata: Metadata = { title: 'Groups' };

/**
 * Groups directory. Lists the owner's groups with a member count and their net
 * within each, and a "New group" action. Each card links to the group's detail
 * page (members, who-owes-whom, and the group's expenses).
 */
export default async function GroupsPage() {
  await requireUser();
  const groups = await listGroups();

  const header = (
    <PageHeader
      eyebrow="Groups"
      title="Groups"
      description="Organise expenses by trip, household, or team."
      action={<CreateGroupDialog />}
    />
  );

  if (groups.length === 0) {
    return (
      <section className="space-y-6">
        {header}
        <EmptyState
          icon={<Users2 />}
          title="No groups yet"
          description="Create a group to keep a trip or household's expenses and balances together, separate from everything else."
          action={<CreateGroupDialog />}
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {header}
      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map(({ group, memberCount, netCents }) => (
          <Link
            key={group.id}
            href={`${ROUTES.groups}/${group.id}`}
            className="group rounded-xl border border-border/50 bg-background/30 p-4 outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/40 hover:shadow-glow-sm focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{group.name}</p>
                <p className="text-xs text-muted-foreground">
                  {groupTypeLabel(group.type)} · {memberCount}{' '}
                  {memberCount === 1 ? 'person' : 'people'}
                </p>
              </div>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-transform duration-200 group-hover:scale-110 [&_svg]:h-4 [&_svg]:w-4">
                <Users2 />
              </span>
            </div>
            <div className="mt-3">
              <BalanceLabel netCents={netCents} subject="them" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
