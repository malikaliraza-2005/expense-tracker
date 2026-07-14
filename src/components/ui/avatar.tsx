import * as React from 'react';

import { cn } from '@/utils/cn';
import { initials } from '@/utils/format';

/**
 * Lightweight initials avatar. Avatar image upload lands in a later phase
 * (Phase 6); until then this renders a stable, accessible initials badge, so the
 * project avoids pulling in `@radix-ui/react-avatar` before it is needed.
 */
export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string | null | undefined;
}

const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  ({ name, className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground',
          className,
        )}
        aria-hidden="true"
        {...props}
      >
        {initials(name)}
      </span>
    );
  },
);
Avatar.displayName = 'Avatar';

export { Avatar };
