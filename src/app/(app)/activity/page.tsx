import type { Metadata } from 'next';

import { Bell } from 'lucide-react';

import { ActivityView } from '@/components/activity/activity-view';
import { MarkReadOnView } from '@/components/activity/mark-read-on-view';
import { OutstandingBalances } from '@/components/activity/outstanding-balances';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { requireUser } from '@/lib/auth';
import { getActivity } from '@/lib/queries/activity';
import { getSelfMemberId } from '@/lib/queries/balances';
import { getMembersWithBalances } from '@/lib/queries/members';

export const metadata: Metadata = { title: 'Activity' };

/**
 * Activity page (Phase 1). A chronological, newest-first history of everything
 * involving the current user — expenses, groups, settlements, and friends. Each row
 * is resolved server-side (RLS returns only the user's own feed) and rendered by the
 * presentational {@link ActivityView}. Opening the page marks the feed read.
 */
export default async function ActivityPage() {
  const user = await requireUser();
  const [items, balances, selfMemberId] = await Promise.all([
    getActivity(),
    getMembersWithBalances(),
    getSelfMemberId(),
  ]);
  const hasUnread = items.some((item) => item.readAt === null);

  // Live balances that can still be cleared — derived, never stored.
  const outstanding = balances.filter(
    (entry) => !entry.member.is_self && entry.netCents !== 0,
  );

  const header = (
    <PageHeader
      eyebrow="Activity"
      title="Activity"
      description="Everything that’s happened across your expenses, groups, and friends."
    />
  );

  if (items.length === 0 && outstanding.length === 0) {
    return (
      <section className="space-y-6">
        {header}
        <EmptyState
          icon={<Bell />}
          title="No activity yet"
          description="As you add expenses, create groups, settle up, and add friends, everything shows up here — newest first."
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <MarkReadOnView hasUnread={hasUnread} />
      {header}
      <OutstandingBalances balances={outstanding} selfMemberId={selfMemberId} />
      {items.length > 0 ? (
        <ActivityView items={items} meId={user.id} />
      ) : null}
    </section>
  );
}
