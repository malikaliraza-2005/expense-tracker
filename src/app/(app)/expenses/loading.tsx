import { ListCardSkeleton } from '@/components/common/loading-skeletons';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Expenses list loading UI. Streams an instant header + list shell while the
 * Server Component resolves its data, so navigation never flashes blank.
 */
export default function ExpensesLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-48" />
      </div>
      <ListCardSkeleton rows={6} />
    </div>
  );
}
