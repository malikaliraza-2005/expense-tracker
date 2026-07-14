import { Skeleton } from '@/components/ui/skeleton';

/** Global route-level loading fallback. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
