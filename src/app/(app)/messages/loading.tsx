import { ListCardSkeleton } from '@/components/common/loading-skeletons';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Messages list loading UI. Streams an instant header + list shell while the Server
 * Component resolves conversations, so navigation never flashes blank.
 */
export default function MessagesLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-40" />
      </div>
      <ListCardSkeleton rows={5} />
    </div>
  );
}
