import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Reusable premium loading skeletons (shimmer). Route-level `loading.tsx` files
 * render these while a Server Component's data resolves, so no list or overview
 * dead-ends on a blank screen.
 */

/** A single list-row placeholder: glyph tile + two text lines + trailing amount. */
export function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/30 p-3">
      <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-4 w-16 shrink-0" />
    </div>
  );
}

/** A list of {@link RowSkeleton}s inside a titled glass card. */
export function ListCardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <RowSkeleton key={index} />
        ))}
      </CardContent>
    </Card>
  );
}

/** The stat tiles, as skeletons. */
export function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="p-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
          <Skeleton className="mt-3 h-8 w-28" />
          <Skeleton className="mt-2 h-3 w-24" />
        </Card>
      ))}
    </div>
  );
}

/** Full dashboard placeholder: hero over stat tiles over list cards. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-48" />
      <Card className="p-6 sm:p-8">
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:justify-between">
          <div className="w-full space-y-4 sm:max-w-sm">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-12 w-48" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          </div>
          <Skeleton className="h-48 w-48 shrink-0 rounded-full" />
        </div>
      </Card>
      <SummaryCardsSkeleton />
      <div className="grid gap-4 lg:grid-cols-2">
        <ListCardSkeleton rows={4} />
        <ListCardSkeleton rows={4} />
      </div>
    </div>
  );
}
