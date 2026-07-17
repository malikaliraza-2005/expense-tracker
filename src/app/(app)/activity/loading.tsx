import { ListCardSkeleton } from '@/components/common/loading-skeletons';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Activity feed loading UI. Streams an instant header + list shell while the Server
 * Component resolves the feed, so navigation never flashes blank.
 */
export default function ActivityLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-36" />
      </div>
      <ListCardSkeleton rows={6} />
    </div>
  );
}
