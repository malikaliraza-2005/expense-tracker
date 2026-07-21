import { ListCardSkeleton } from '@/components/common/loading-skeletons';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Requests loading UI. Streams the header, a tab-strip placeholder, and a list
 * shell while the Server Component resolves invitations, so navigating to
 * Requests never flashes blank.
 */
export default function RequestsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-44" />
      </div>
      <div className="flex gap-2 border-b border-border/50 pb-px">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-24 rounded-md" />
        ))}
      </div>
      <ListCardSkeleton rows={4} />
    </div>
  );
}
