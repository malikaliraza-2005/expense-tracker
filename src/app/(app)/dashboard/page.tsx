import type { Metadata } from 'next';
import Link from 'next/link';

import { LayoutDashboard, Plus, Users } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { GroupsOverview } from '@/components/dashboard/groups-overview';
import { RecentExpenses } from '@/components/dashboard/recent-expenses';
import { RecentSettlements } from '@/components/dashboard/recent-settlements';
import { SummaryCards } from '@/components/dashboard/summary-cards';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { requireUser } from '@/lib/auth';
import { getDashboard } from '@/lib/queries/dashboard';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * Dashboard (Phase 5). Server Component: the home overview. Reads the assembled
 * dashboard data (balance summary + recent activity + groups, all RLS-scoped and
 * settlement-aware) and renders the summary cards, recent expenses, recent
 * settlements, and groups overview — with quick-add entry points. When there's no
 * activity at all, it shows a single onboarding empty state instead.
 */
export default async function DashboardPage() {
  const user = await requireUser();
  const dashboard = await getDashboard();

  const isEmpty =
    !dashboard ||
    (dashboard.recentExpenses.length === 0 &&
      dashboard.recentSettlements.length === 0 &&
      dashboard.groups.length === 0 &&
      dashboard.summary.netCents === 0 &&
      dashboard.summary.owedToMeCents === 0 &&
      dashboard.summary.iOweCents === 0);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Your balances and recent activity at a glance."
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={ROUTES.newGroup}>
                <Users />
                New group
              </Link>
            </Button>
            <Button asChild>
              <Link href={ROUTES.newExpense}>
                <Plus />
                Add expense
              </Link>
            </Button>
          </div>
        }
      />

      {isEmpty ? (
        <EmptyState
          icon={<LayoutDashboard />}
          title="Nothing here yet"
          description="Add an expense or create a group to start tracking balances. Your totals and recent activity will show up here."
          action={
            <Button asChild>
              <Link href={ROUTES.newExpense}>
                <Plus />
                Add your first expense
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <SummaryCards summary={dashboard.summary} />
          <RecentExpenses
            expenses={dashboard.recentExpenses}
            currentUserId={user.id}
          />
          <RecentSettlements
            settlements={dashboard.recentSettlements}
            currentUserId={user.id}
          />
          <GroupsOverview groups={dashboard.groups} />
        </>
      )}
    </section>
  );
}
