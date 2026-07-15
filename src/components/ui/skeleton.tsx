import { cn } from '@/utils/cn';

/**
 * Premium loading skeleton: a muted block with an animated shimmer sweep
 * (see `.shimmer` in globals.css). Motion is disabled under reduced-motion.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('shimmer rounded-lg bg-muted/60', className)}
      {...props}
    />
  );
}

export { Skeleton };
