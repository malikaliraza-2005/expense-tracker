import Link from 'next/link';

import { Logo } from '@/components/common/logo';
import { MobileNav } from '@/components/layout/mobile-nav';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { ROUTES } from '@/constants/routes';

/**
 * Mobile top bar (Phase 6). Shown only below `md` (the sidebar replaces it on
 * larger screens). Hosts the drawer trigger, the brand, and the theme toggle;
 * sticky so navigation is always reachable.
 */
export function TopNav({
  name,
  avatarUrl,
}: {
  name: string | null;
  avatarUrl: string | null;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-xl md:hidden">
      <div className="flex items-center gap-2">
        <MobileNav name={name} avatarUrl={avatarUrl} />
        <Link
          href={ROUTES.dashboard}
          className="rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo size="sm" />
        </Link>
      </div>
      <ThemeToggle />
    </header>
  );
}
