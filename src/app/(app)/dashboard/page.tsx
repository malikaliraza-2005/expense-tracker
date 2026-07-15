import type { Metadata } from 'next';
import Link from 'next/link';

import { LayoutDashboard, Plus } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { LiveClock } from '@/components/dashboard/live-clock';
import { OutstandingHero } from '@/components/dashboard/outstanding-hero';
import { RecentExpenses } from '@/components/dashboard/recent-expenses';
import { SpendingInsights } from '@/components/dashboard/spending-insights';
import { SummaryCards } from '@/components/dashboard/summary-cards';
import { Reveal } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { requireUser } from '@/lib/auth';
import { getDashboard } from '@/lib/queries/dashboard';
import { getCurrentProfile } from '@/lib/queries/profile';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * Dashboard (redesigned). An outstanding-first overview: a hero splitting
 * outstanding vs settled spend, key stat tiles, spending insights, and only the
 * outstanding expenses — each section easing in on entry. When there's no
 * activity at all, a single onboarding empty state takes over.
 */
export default async function DashboardPage() {
  const user = await requireUser();
  const [dashboard, profile] = await Promise.all([
    getDashboard(),
    getCurrentProfile(),
  ]);

  const isEmpty = !dashboard || dashboard.expenseCount === 0;

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="What's outstanding and your recent activity at a glance."
        action={
          <Button asChild variant="gradient">
            <Link href={ROUTES.newExpense}>
              <Plus />
              Add expense
            </Link>
          </Button>
        }
      />

      <LiveClock name={profile?.full_name ?? null} />

      {isEmpty ? (
        <EmptyState
          icon={<LayoutDashboard />}
          title="Nothing here yet"
          description="Add your first expense and split it with the people you share costs with. Your totals, insights, and outstanding items will show up here."
          action={
            <Button asChild variant="gradient">
              <Link href={ROUTES.newExpense}>
                <Plus />
                Add your first expense
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <Reveal>
            <OutstandingHero
              outstandingCents={dashboard.outstandingCents}
              settledCents={dashboard.settledCents}
              outstandingCount={dashboard.outstandingCount}
              settledCount={dashboard.settledCount}
            />
          </Reveal>

          <Reveal delay={0.05}>
            <SummaryCards
              monthlySpendCents={dashboard.monthlySpendCents}
              expenseCount={dashboard.expenseCount}
              outstandingCount={dashboard.outstandingCount}
              settledCount={dashboard.settledCount}
            />
          </Reveal>

          <div className="grid gap-4 lg:grid-cols-2">
            {dashboard.categoryBreakdown.length > 0 ? (
              <Reveal delay={0.1}>
                <SpendingInsights
                  breakdown={dashboard.categoryBreakdown}
                  monthlySpendCents={dashboard.monthlySpendCents}
                />
              </Reveal>
            ) : null}
            <Reveal delay={0.15}>
              <RecentExpenses
                expenses={dashboard.recentOutstanding}
                currentUserId={user.id}
              />
            </Reveal>
          </div>
        </>
      )}
    </section>
  );
}
