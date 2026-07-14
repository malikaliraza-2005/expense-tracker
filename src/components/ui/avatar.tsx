'use client';

import * as React from 'react';

import { cn } from '@/utils/cn';
import { initials } from '@/utils/format';

/**
 * Avatar with an image and an accessible initials fallback. When `src` is set
 * the uploaded image is shown; if it is absent or fails to load, a stable
 * initials badge is rendered instead (so the UI never dead-ends on a broken
 * image). Avatar uploads landed in Phase 6; earlier phases pass only `name`,
 * which keeps rendering the initials badge exactly as before.
 */
export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string | null | undefined;
  /** Public avatar URL. Falls back to initials when unset or unreachable. */
  src?: string | null;
}

const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  ({ name, src, className, ...props }, ref) => {
    const [failed, setFailed] = React.useState(false);
    const showImage = Boolean(src) && !failed;

    return (
      <span
        ref={ref}
        className={cn(
          'relative inline-flex h-9 w-9 shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium text-muted-foreground ring-1 ring-border ring-offset-1 ring-offset-background',
          className,
        )}
        {...props}
      >
        {showImage ? (
          // A plain <img> (not next/image): the avatar host is dynamic
          // (Supabase Storage), so this avoids per-env remotePatterns config for
          // a small, cache-friendly asset.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src as string}
            alt={name ? `${name}'s avatar` : 'Avatar'}
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <span aria-hidden="true">{initials(name)}</span>
        )}
      </span>
    );
  },
);
Avatar.displayName = 'Avatar';

export { Avatar };
