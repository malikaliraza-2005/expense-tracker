import { notFound } from 'next/navigation';

import { Eye } from 'lucide-react';

import { GroupActions } from '@/components/groups/group-actions';
import { GroupTabs } from '@/components/groups/group-tabs';
import { Badge } from '@/components/ui/badge';
import { groupTypeLabel } from '@/constants/group-types';
import { requireUser } from '@/lib/auth';
import { getGroup } from '@/lib/queries/groups';

/**
 * Group shell shared by every group sub-route (Overview / Expenses / Members /
 * Balances). Loads the group once for the header and renders the tab bar; each
 * child page fetches only its own group-scoped data, so nothing from other
 * groups or general activity can leak in.
 *
 * Since 0023 a participant can open a group they've been added to (that's what makes the
 * "X added you to …" notification land somewhere). They get a read-only shell: renaming
 * and deleting are owner-scoped writes, so offering them a Delete button would only lead
 * to a no-op the database quietly reports as success. Mirrors the expense detail page.
 */
export default async function GroupLayout({
  params,
  children,
}: {
  params: { groupId: string };
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const group = await getGroup(params.groupId);
  if (!group) notFound();
  const isOwner = group.owner_id === user.id;

  return (
    <section className="space-y-6">
      {/* No bespoke back link: the app header's back arrow covers every page. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
          <Badge variant="secondary">{groupTypeLabel(group.type)}</Badge>
        </div>
        {isOwner ? (
          <GroupActions
            groupId={group.id}
            groupName={group.name}
            groupType={group.type}
          />
        ) : (
          <Badge variant="secondary" className="shrink-0">
            <Eye className="h-3 w-3" />
            Shared with you · view only
          </Badge>
        )}
      </div>

      <GroupTabs groupId={group.id} />

      {children}
    </section>
  );
}
