import { DashboardSkeleton } from '@/components/common/loading-skeletons';

/**
 * Dashboard loading UI (Phase 5). Rendered by Next.js while the dashboard's
 * Server Component resolves its data, so the home page never flashes blank.
 */
export default function DashboardLoading() {
  return <DashboardSkeleton />;
}
