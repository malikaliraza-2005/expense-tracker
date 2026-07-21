'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { MessagesSquare, Plus } from 'lucide-react';

import { Logo } from '@/components/common/logo';
import { BackButton } from '@/components/layout/back-button';
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
  messagesUnread = 0,
}: {
  name: string | null;
  avatarUrl: string | null;
  badges?: NavBadges;
  /** Unread direct-message count, shown as a badge on the inbox icon. */
  messagesUnread?: number;
}) {
  const pathname = usePathname();
  const messagesActive = isActiveRoute(pathname, ROUTES.messages);

  return (
    <header className="glass sticky top-0 z-30 border-x-0 border-t-0">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Back arrow sits ahead of the brand and appears on any non-root page, so
            every screen has one consistent way back to wherever you came from. */}
        <div className="flex min-w-0 items-center gap-1">
          <BackButton pathname={pathname} />
          <Link
            href={ROUTES.dashboard}
            className="min-w-0 rounded-lg outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Logo size="sm" />
          </Link>
        </div>

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

          {/* Direct-message inbox — sits beside the account avatar on every screen.
              Its badge shows the unread-message count (omitted when zero). */}
          <Link
            href={ROUTES.messages}
            aria-label={
              messagesUnread > 0
                ? `Messages, ${messagesUnread} unread`
                : 'Messages'
            }
            aria-current={messagesActive ? 'page' : undefined}
            className={cn(
              'relative flex h-10 w-10 items-center justify-center rounded-full outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:w-9',
              messagesActive ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <MessagesSquare className="h-5 w-5" />
            {messagesUnread > 0 ? (
              <span
                aria-hidden="true"
                className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-white shadow-glow-sm"
              >
                {badgeLabel(messagesUnread)}
              </span>
            ) : null}
          </Link>

          <UserMenu name={name} avatarUrl={avatarUrl} />
        </div>
      </div>
    </header>
  );
}
