import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Reusable loading skeletons. Route-level `loading.tsx` files render these while a
 * Server Component's data resolves, so no list or overview dead-ends on a blank
 * screen (development-guidelines.md §4).
 */

/** A single list-row placeholder: avatar bubble + two text lines + trailing amount. */
export function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-4 w-16 shrink-0" />
    </div>
  );
}

/** A list of {@link RowSkeleton}s inside a titled card. */
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

/** The three summary stat cards, as skeletons. */
export function SummaryCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Full dashboard placeholder: summary cards over two list cards. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <SummaryCardsSkeleton />
      <ListCardSkeleton rows={4} />
      <ListCardSkeleton rows={3} />
    </div>
  );
}
