'use client';

import * as React from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { LogOut, Menu, X } from 'lucide-react';

import { signOut } from '@/actions/auth';
import { NavLinks } from '@/components/layout/nav-links';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/constants/app';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/utils/cn';

/**
 * Mobile navigation drawer (Phase 6). A hamburger button that opens a slide-in
 * panel with the primary nav and a footer (profile + logout). Closes on route
 * change, on Escape, and on backdrop click; locks body scroll while open. Only
 * rendered on small screens (the parent hides it at `md+`).
 */
export function MobileNav({
  name,
  avatarUrl,
}: {
  name: string | null;
  avatarUrl: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // Close whenever the route changes (e.g. a nav link was tapped).
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape to close + body scroll lock while open.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu />
      </Button>

      {/* Backdrop */}
      <div
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80%] flex-col border-r bg-background shadow-lg transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-4">
          <Link
            href={ROUTES.dashboard}
            className="font-semibold tracking-tight"
            onClick={() => setOpen(false)}
          >
            {APP_NAME}
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            <X />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavLinks onNavigate={() => setOpen(false)} />
        </div>

        <div className="border-t p-3">
          <Link
            href={ROUTES.profile}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md p-1 outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar name={name} src={avatarUrl} className="h-8 w-8" />
            <span className="truncate text-sm font-medium">
              {name || 'Profile'}
            </span>
          </Link>
          <form action={signOut} className="mt-2">
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
            >
              <LogOut />
              Log out
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
