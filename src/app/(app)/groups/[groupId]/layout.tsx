import Link from 'next/link';
import { notFound } from 'next/navigation';

import { GroupActions } from '@/components/groups/group-actions';
import { GroupTabs } from '@/components/groups/group-tabs';
import { Badge } from '@/components/ui/badge';
import { groupTypeLabel } from '@/constants/group-types';
import { ROUTES } from '@/constants/routes';
import { requireUser } from '@/lib/auth';
import { getGroup } from '@/lib/queries/groups';

/**
 * Group shell shared by every group sub-route (Overview / Expenses / Members /
 * Balances). Loads the group once for the header and renders the tab bar; each
 * child page fetches only its own group-scoped data, so nothing from other
 * groups or general activity can leak in.
 */
export default async function GroupLayout({
  params,
  children,
}: {
  params: { groupId: string };
  children: React.ReactNode;
}) {
  await requireUser();
  const group = await getGroup(params.groupId);
  if (!group) notFound();

  return (
    <section className="space-y-6">
      <Link
        href={ROUTES.groups}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        ← All groups
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
          <Badge variant="secondary">{groupTypeLabel(group.type)}</Badge>
        </div>
        <GroupActions
          groupId={group.id}
          groupName={group.name}
          groupType={group.type}
        />
      </div>

      <GroupTabs groupId={group.id} />

      {children}
    </section>
  );
}
