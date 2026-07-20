import { notFound } from 'next/navigation';

import { Check, Eye } from 'lucide-react';

import { GroupActions } from '@/components/groups/group-actions';
import { GroupTabs } from '@/components/groups/group-tabs';
import { Badge } from '@/components/ui/badge';
import { groupTypeLabel } from '@/constants/group-types';
import { requireUser } from '@/lib/auth';
import { listExpenses } from '@/lib/queries/expenses';
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
  const [group, groupExpenses] = await Promise.all([
    getGroup(params.groupId),
    listExpenses({ groupId: params.groupId }),
  ]);
  if (!group) notFound();
  const isOwner = group.owner_id === user.id;

  // The group's settled state: it has expenses, and all of them are fully settled.
  const hasExpenses = groupExpenses.length > 0;
  const allSettled =
    hasExpenses && groupExpenses.every((item) => item.fullySettled);

  return (
    <section className="space-y-6">
      {/* No bespoke back link: the app header's back arrow covers every page. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
          <Badge variant="secondary">{groupTypeLabel(group.type)}</Badge>
          {hasExpenses ? (
            allSettled ? (
              <Badge variant="success">
                <Check className="h-3 w-3" />
                Settled
              </Badge>
            ) : (
              <Badge variant="warning">Not settled</Badge>
            )
          ) : null}
        </div>
        {isOwner ? (
          <GroupActions
            groupId={group.id}
            groupName={group.name}
            groupType={group.type}
            isPersonal={group.is_personal}
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
