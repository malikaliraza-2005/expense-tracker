import Link from 'next/link';

import { LogOut } from 'lucide-react';

import { signOut } from '@/actions/auth';
import { Logo } from '@/components/common/logo';
import { NavLinks } from '@/components/layout/nav-links';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';

/**
 * Desktop sidebar (Phase 6). Fixed to the left on `md+` and hidden on mobile
 * (the top bar + drawer take over there). Brand at the top, primary nav in the
 * middle, and a footer with the profile link, theme toggle, and logout.
 */
export function AppSidebar({
  name,
  avatarUrl,
}: {
  name: string | null;
  avatarUrl: string | null;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-background/80 backdrop-blur-xl md:flex">
      <div className="flex h-16 items-center border-b px-6">
        <Link
          href={ROUTES.dashboard}
          className="rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo size="sm" />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavLinks />
      </div>

      <div className="border-t p-3">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={ROUTES.profile}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar name={name} src={avatarUrl} className="h-8 w-8" />
            <span className="truncate text-sm font-medium">
              {name || 'Profile'}
            </span>
          </Link>
          <ThemeToggle />
        </div>
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
    </aside>
  );
}
