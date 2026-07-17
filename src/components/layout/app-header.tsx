'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Plus } from 'lucide-react';

import { Logo } from '@/components/common/logo';
import {
  PRIMARY_NAV,
  badgeLabel,
  isActiveRoute,
  type NavBadges,
} from '@/components/layout/nav-config';
import { UserMenu } from '@/components/layout/user-menu';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/utils/cn';

/**
 * App header — the top chrome shared across every screen (no sidebar).
 *
 * On `md+` it is a full desktop navigation bar: brand, a horizontal pill nav
 * with an animated active indicator, and an action cluster (search, add
 * expense, account menu). Below `md` it collapses to a compact bar with the
 * brand, search, and account menu — primary navigation moves to the fixed
 * bottom bar. Sticky and glassy so it always floats above the content.
 */
export function AppHeader({
  name,
  avatarUrl,
  badges,
}: {
  name: string | null;
  avatarUrl: string | null;
  badges?: NavBadges;
}) {
  const pathname = usePathname();

  return (
    <header className="glass sticky top-0 z-30 border-x-0 border-t-0">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href={ROUTES.dashboard}
          className="rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo size="sm" />
        </Link>

        {/* Desktop primary nav */}
        <nav
          aria-label="Primary"
          className="hidden items-center gap-1 md:flex"
        >
          {PRIMARY_NAV.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            const Icon = item.icon;
            const count = badges?.[item.href] ?? 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {active && (
                  <span className="absolute inset-0 -z-10 rounded-lg bg-primary/12 ring-1 ring-inset ring-primary/25" />
                )}
                <Icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                {item.label}
                {count > 0 ? (
                  <span
                    aria-label={`${count} awaiting you`}
                    className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-white shadow-glow-sm"
                  >
                    {badgeLabel(count)}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button asChild variant="gradient" className="hidden sm:inline-flex">
            <Link href={ROUTES.newExpense}>
              <Plus />
              Add expense
            </Link>
          </Button>
          <UserMenu name={name} avatarUrl={avatarUrl} />
        </div>
      </div>
    </header>
  );
}
